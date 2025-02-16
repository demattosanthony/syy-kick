import z from "zod";
import s3 from "../config/s3";
import {
  MessageAttachment,
  messageAttachments,
  messages,
  threads,
} from "../config/schema";
import db from "../config/db";
import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";
import { Request, Response, Router } from "express";
import {
  Attachment,
  CoreMessage,
  generateObject,
  Message,
  streamText,
} from "ai";
import { CONFIG } from "../config/constants";
import { handle, generateThreadTitle } from "../utils";
import { embeddingModel, MODELS } from "./models";

// Input validation
const schemas = {
  inference: z.object({
    model: z.string(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    instructions: z.string().optional(),
    proejctId: z.string().optional(),
  }),
};

type ExtendedAttachment = Attachment & {
  file_key: string;
};

type MyMessage = Message & {
  experimental_attachments?: ExtendedAttachment[];
};

type ThreadWithMessages = {
  id: string;
  title?: string | null;
  userId: string;
  organizationId?: string | null;
  projectId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: {
    id: string;
    threadId: string;
    userId: string;
    role: "system" | "user" | "assistant" | "tool";
    text: string | null;
    reasoning?: string | null;
    model?: string | null;
    provider?: string | null;
    createdAt: Date;
    attachments: MessageAttachment[];
    content?: any; // This will be added by processFile
  }[];
  project?: any;
  organization?: any;
};

const ops = {
  // Shared file processing logic
  processMessage: async (attachments: MessageAttachment[]) => {
    try {
      // Add presigned URLs to each attachment
      const processedAttachments = attachments.map((attachment) => {
        const metadata = s3.file(attachment.fileKey);
        const url = metadata.presign({
          acl: "public-read",
          expiresIn: 3600,
          method: "GET",
        });
        return {
          ...attachment,
          url,
        };
      });

      return processedAttachments;
    } catch (error) {
      console.error("Error processing attachments:", error);
      return attachments;
    }
  },

  // Process all messages in a thread
  processThreadMessages: async (thread: ThreadWithMessages) => {
    if (!thread) return null;

    for (const message of thread.messages) {
      message.attachments = await ops.processMessage(message.attachments);
    }
    return thread;
  },

  async createMessage(
    userId: string,
    threadId: string,
    role: string,
    message: MyMessage
  ) {
    const messageId = crypto.randomUUID();

    let embedding = null;
    try {
      const embeddingResult = await embeddingModel.doEmbed({
        values: [message.content],
      });
      embedding = embeddingResult.embeddings[0];
    } catch (error) {
      console.error("Error embedding message", error);
    }

    await db.insert(messages).values({
      userId,
      id: messageId,
      threadId: threadId,
      role: role as "system" | "user" | "assistant" | "tool", // Type assertion for role
      text: message.content,
      embedding,
      createdAt: new Date(),
    });

    if (message.experimental_attachments) {
      for (const attachment of message.experimental_attachments) {
        await db.insert(messageAttachments).values({
          messageId,
          fileName: attachment.name,
          mimeType: attachment.contentType,
          fileKey: attachment.file_key,
          type: attachment.contentType?.includes("image") ? "image" : "file",
        });
      }
    }
    return { message: "Messages created successfully" };
  },

  // Get model config
  async getModelConfig(model: string, messages: MyMessage[]) {
    if (model !== "Auto") {
      return MODELS[model];
    }

    // Check for PDFs or images in attachments or previous messages
    const hasMediaContent = messages.some((msg) => {
      const content = msg.content as any;
      return (
        msg.experimental_attachments?.some(
          (attachment) =>
            attachment.contentType?.includes("pdf") ||
            attachment.contentType?.includes("image")
        ) ||
        content.type === "image" ||
        (content.type === "file" &&
          content.file_metadata?.mime_type?.includes("pdf"))
      );
    });

    if (hasMediaContent) {
      return MODELS["gemini-2.0-flash"];
    }

    // Get the full conversation text for context
    const conversationText = messages
      .map((msg) => {
        return `${msg.role}: ${msg.content}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const { object } = await generateObject({
      prompt: `Based on the conversation below, classify the type of request into one of these categories:

- web_search: For queries requiring up-to-date information, current events, research, or fact-checking
- coding: For programming help, code reviews, debugging, or technical implementation questions
- type_1_thinking: For quick, straightforward responses requiring direct logic and factual analysis
- type_2_thinking: For complex reasoning, deep analysis, or creative problem-solving tasks

Conversation:

${conversationText}`,
      schema: z.object({
        request_type: z.enum([
          "web_search",
          "coding",
          "type_1_thinking",
          "type_2_thinking",
        ]),
      }),
      model: MODELS["claude-3.5-sonnet"].model,
    });

    const type = object.request_type;
    if (type === "coding") {
      return MODELS["claude-3.5-sonnet"];
    }
    if (type === "type_1_thinking") {
      return MODELS["gemini-2.0-flash"];
    }
    if (type === "type_2_thinking") {
      return MODELS["o1"];
    }
    if (type === "web_search") {
      return MODELS["sonar-pro"];
    }

    return MODELS[object.request_type];
  },

  generateTitle: async (threadId: string, rawMessages: MyMessage[]) => {
    const firstUserTextMessage = rawMessages.find((msg) => msg.role === "user");

    if (firstUserTextMessage) {
      try {
        const title = await generateThreadTitle(firstUserTextMessage.content);
        await db.update(threads).set({ title }).where(eq(threads.id, threadId));
      } catch (error) {
        console.error("Error generating title", error);
      }
    }
  },

  threads: {
    create: async (
      userId: string,
      organizationId?: string,
      projectId?: string
    ): Promise<{ id: string }> => {
      if (!userId) throw new Error("User ID is required");
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(threads).values({
        id,
        userId,
        organizationId: organizationId || null,
        projectId: projectId || null,
        createdAt: now,
        updatedAt: now,
      });
      return { id };
    },

    getThread: async (threadId: string) => {
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
        with: {
          messages: {
            orderBy: messages.createdAt,
            columns: {
              embedding: false, // Exclude embedding from the query
              id: true,
              threadId: true,
              userId: true,
              role: true,
              text: true,
              reasoning: true,
              model: true,
              provider: true,
              createdAt: true,
            },
            with: {
              attachments: true,
            },
          },
          project: true,
          organization: true,
        },
      });

      if (!thread) return null;
      return ops.processThreadMessages({
        ...thread,
        messages: thread.messages.map((msg) => ({
          ...msg,
          attachments: msg.attachments.map((att) => ({
            ...att,
            fileName: att.fileName ?? undefined,
            mimeType: att.mimeType ?? undefined,
            size: att.size ?? undefined,
            fileKey: att.fileKey ?? undefined,
          })),
        })),
      });
    },

    getThreads: async (
      userId: string,
      page: number,
      search: string,
      organizationId?: string
    ) => {
      const LIMIT = 10;
      const offset = (page - 1) * LIMIT;

      let baseQuery;
      const conditions = [eq(threads.userId, userId)];

      // Add organization condition
      if (organizationId) {
        conditions.push(eq(threads.organizationId, organizationId));
      } else {
        conditions.push(sql`${threads.organizationId} IS NULL`);
      }

      if (search.length > 0) {
        const searchEmbedding = await embeddingModel.doEmbed({
          values: [search],
        });

        const similarity = sql<number>`1 - (${cosineDistance(
          messages.embedding,
          searchEmbedding.embeddings[0]
        )})`;

        baseQuery = db
          .select({
            id: threads.id,
            created_at: threads.createdAt,
            updated_at: threads.updatedAt,
            max_similarity: sql<number>`MAX(${similarity})`.as(
              "max_similarity"
            ),
          })
          .from(threads)
          .leftJoin(messages, eq(threads.id, messages.threadId))
          .where(and(...conditions))
          .groupBy(threads.id, threads.createdAt, threads.updatedAt)
          .having(sql`MAX(${similarity}) > 0.5`)
          .orderBy(desc(sql`max_similarity`));
      } else {
        baseQuery = db
          .select({
            id: threads.id,
            created_at: threads.createdAt,
            updated_at: threads.updatedAt,
          })
          .from(threads)
          .leftJoin(messages, eq(threads.id, messages.threadId))
          .where(and(...conditions))
          .groupBy(threads.id, threads.createdAt, threads.updatedAt)
          .orderBy(desc(threads.createdAt));
      }

      const matchingThreads = await baseQuery.limit(LIMIT).offset(offset);

      const completeThreads = await db.query.threads.findMany({
        where: (threads, { and, eq, inArray }) =>
          and(
            eq(threads.userId, userId),
            organizationId
              ? eq(threads.organizationId, organizationId)
              : sql`${threads.organizationId} IS NULL`,
            inArray(
              threads.id,
              matchingThreads.map((t) => t.id)
            )
          ),
        orderBy: [desc(threads.createdAt)],
        with: {
          messages: {
            orderBy: messages.createdAt,
          },
        },
      });

      // Process all threads
      return Promise.all(
        completeThreads.map((thread) =>
          ops.processThreadMessages({
            ...thread,
            messages: thread.messages.map((msg) => ({
              ...msg,
              attachments: [], // Add empty attachments array since it's required by ThreadWithMessages
            })),
          })
        )
      );
    },

    inference: async (req: Request, res: Response) => {
      try {
        const { threadId } = req.params;
        const { model, maxTokens, temperature, instructions, project_content } =
          req.body;
        const message = req.body.message as MyMessage;

        // Set headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
        res.setHeader("Transfer-Encoding", "chunked");
        res.flushHeaders(); // send headers to establish SSE connection

        const thread = await ops.threads.getThread(threadId);

        if (!thread) {
          console.error("Thread not found");
          res.status(404).json({ error: "Thread not found" });
          return;
        }

        // add the messages to the thread
        await ops.createMessage(req.dbUser!.id, threadId, "user", message);

        // Get and filter messages
        const rawMessages = await db.query.messages.findMany({
          where: eq(messages.threadId, threadId),
          orderBy: messages.createdAt,
          with: {
            attachments: true,
          },
        });

        const transformedMessages: MyMessage[] = rawMessages.map((msg) => {
          const experimental_attachments: ExtendedAttachment[] =
            msg.attachments?.map((att) => ({
              name: att.fileName || undefined, // Convert null to undefined
              file_key: att.fileKey,
              contentType: att.mimeType || undefined, // Convert null to undefined
              url: s3.file(att.fileKey).presign({ expiresIn: 3600 }),
            })) || [];

          return {
            id: msg.id,
            role: msg.role as any,
            content: msg.text || "",
            experimental_attachments,
          };
        });

        // In the inference function, replace the modelConfig section with:
        const modelConfig = await ops.getModelConfig(
          model,
          transformedMessages
        );

        // If thread has no title, generate one
        if (!thread.title) {
          await ops.generateTitle(threadId, transformedMessages);
        }

        const filteredMessages = transformedMessages.filter((msg) => {
          // If there are no attachments, or it's just text content, include the message
          if (!msg.experimental_attachments?.length) return true;

          // Check if all attachments are supported by the model
          return msg.experimental_attachments.every((attachment) =>
            modelConfig.supportedMimeTypes?.includes(
              attachment.contentType || ""
            )
          );
        });

        // Process message content
        const processMessageContent = async (message: MyMessage) => {
          const results = [];

          // Process main text content
          if (message.content) {
            results.push({ type: "text", text: message.content });
          }

          // Process attachments if any
          if (message.experimental_attachments?.length) {
            for (const attachment of message.experimental_attachments) {
              const metadata = s3.file(attachment.file_key);

              // Can only generate presigned URLs in production because local urls are not accessible to the AI apis
              const getContentData = async () => {
                if (CONFIG.__prod__) {
                  return metadata.presign({ expiresIn: 60 * 20 }); // 20 minutes
                }

                const buffer = Buffer.from(
                  new Uint8Array(await metadata.arrayBuffer())
                );
                return `data:${attachment.contentType};base64,${buffer.toString(
                  "base64"
                )}`;
              };

              const type = attachment.contentType?.includes("image")
                ? "image"
                : "file";
              results.push({
                type,
                mimeType: attachment.contentType,
                [type === "image" ? "image" : "data"]: await getContentData(),
              });
            }
          }

          return results;
        };

        // Build messages array
        let inferenceMessages = (await Promise.all(
          filteredMessages.map(async (msg) => ({
            role: msg.role as any,
            reasoning:
              msg.parts?.find((part) => part.type === "reasoning") || null,
            content: await processMessageContent(msg),
          }))
        )) as CoreMessage[];

        // Build system message
        let yoSystemMessage = `<assistant_instructions>
Your name is Yo. You are a multi-disciplinary engineer with vast expertise across diverse fields such as building systems, product design, automation, and project management. Whether it’s creating bill of materials, automating processes, or exploring new technical projects, you always provide clear, precise, and actionable advice. You combine technical depth with a friendly, professional, and accessible tone, making you both brilliant and approachable. When responding, use markdown formatting. Make your explanations straightforward, insightful, and easy to understand.
</assistant_instructions>
    
<current_date>
It is currently: ${new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}
</current_date>`;

        if (instructions && instructions.length > 0) {
          yoSystemMessage += `<user_instructions>${instructions}</user_instructions>`;
        }

        const inferenceParams = {
          model: modelConfig.model,
          messages: inferenceMessages as CoreMessage[],
          temperature,
          system: modelConfig.supportsSystemMessages
            ? yoSystemMessage
            : undefined,
          // experimental_providerMetadata: { openai: { reasoningEffort: "high" } },
          maxTokens: maxTokens || undefined,
        };

        let aiResponse = "";
        let reasoning: string | undefined = undefined;

        // Handle client abort or end of response
        req.on("close", async () => {
          const aiResponseEmbedding = await embeddingModel.doEmbed({
            values: [aiResponse],
          });

          await db.insert(messages).values({
            userId: req.dbUser!.id,
            id: crypto.randomUUID(),
            threadId: threadId,
            role: "assistant",
            text: aiResponse,
            reasoning: reasoning,
            createdAt: new Date(),
            model: model,
            embedding: aiResponseEmbedding.embeddings[0],
            provider: modelConfig.provider,
          });

          res.end();
        });

        const result = streamText({
          ...inferenceParams,
          // experimental_transform: smoothStream(),
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") {
              aiResponse += chunk.textDelta;
            } else if (chunk.type === "reasoning") {
              if (!reasoning) {
                reasoning = "";
              }
              reasoning += chunk.textDelta;
            }
          },
        });

        return result.pipeDataStreamToResponse(res, {
          sendReasoning: true,
        });
      } catch (error) {
        console.error("Error in inference:", error);
        res.status(500).json({
          error: "An error occurred during inference",
        });
      }
    },

    deleteThread: async (
      userId: string,
      threadId: string,
      organizationId?: string
    ) => {
      // Delete all messages first due to foreign key constraint
      await db
        .delete(messages)
        .where(
          and(eq(messages.threadId, threadId), eq(messages.userId, userId))
        );

      // Delete the thread
      await db
        .delete(threads)
        .where(
          and(
            eq(threads.id, threadId),
            eq(threads.userId, userId),
            organizationId
              ? eq(threads.organizationId, organizationId)
              : sql`${threads.organizationId} IS NULL`
          )
        );

      return { success: true };
    },
  },
};

// Mount routes
export default Router()
  .post(
    "/",
    handle(async (req) => {
      const { organizationId, projectId } = req.body;
      return ops.threads.create(req.dbUser!.id, organizationId, projectId);
    })
  )
  .get(
    "/",
    handle(async (req) => {
      const { page, search, organizationId } = req.query;
      return ops.threads.getThreads(
        req.dbUser!.id,
        parseInt(page as string) || 1,
        (search as string)?.trim() || "",
        organizationId as string | undefined
      );
    })
  )
  .get(
    "/:threadId",
    handle(async (req) => {
      return ops.threads.getThread(req.params.threadId);
    })
  )
  .post("/:threadId/inference", (req, res) => {
    return schemas.inference
      .parseAsync(req.body)
      .then(() => ops.threads.inference(req, res))
      .catch((error) => {
        console.error("Error in inference endpoint:", error);
        res.status(500).json({
          error: "An error occurred during inference",
          details: error.message,
        });
      });
  })
  .delete(
    "/:threadId",
    handle(async (req) => {
      const { organizationId } = req.query;
      return ops.threads.deleteThread(
        req.dbUser!.id,
        req.params.threadId,
        organizationId as string | undefined
      );
    })
  );
