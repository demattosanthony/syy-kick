import z from "zod";
import s3 from "../config/s3";
import { ContentPart, messages, threads } from "../config/schema";
import db from "../config/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Request, Response, Router } from "express";
import { CoreMessage, generateObject, Message, streamText } from "ai";
import { CONFIG } from "../config/constants";
import { handle, generateThreadTitle } from "../utils";
import { MODELS } from "./models";

// Input validation
const schemas = {
  inference: z.object({
    model: z.string(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    instructions: z.string().optional(),
  }),
};

type ExtendedAttachment = {
  name?: string;
  contentType?: string;
  url: string;
  file_key: string;
};

const ops = {
  // Shared file processing logic
  processFile: async (content: any) => {
    try {
      if (content.type !== "file" && content.type !== "image") return content;
      if (!content.file_metadata?.file_key) return content;

      const metadata = s3.file(content.file_metadata.file_key);
      const url = metadata.presign({
        acl: "public-read",
        expiresIn: 3600,
        method: "GET",
      });
      return { ...content, data: url };
    } catch (error) {
      console.error("Error processing file:", error);
      return content;
    }
  },

  // Process all messages in a thread
  processThreadMessages: async (thread: any) => {
    if (!thread) return null;

    for (const message of thread.messages) {
      message.content = await ops.processFile(message.content);
    }
    return thread;
  },

  async createMessage(
    userId: string,
    threadId: string,
    role: string,
    content: ContentPart[]
  ) {
    for (const item of content) {
      const messageId = crypto.randomUUID();
      await db.insert(messages).values({
        userId,
        id: messageId,
        threadId: threadId,
        role: role as "system" | "user" | "assistant" | "tool", // Type assertion for role
        content: item,
        createdAt: new Date(),
      });
    }
    return { message: "Messages created successfully" };
  },

  // Get model config
  async getModelConfig(
    model: string,
    messages: { role: string; content: ContentPart }[],
    attachments?: ExtendedAttachment[]
  ) {
    if (model !== "Auto") {
      return MODELS[model];
    }

    // Check for PDFs or images in attachments or previous messages
    const hasMediaContent =
      attachments?.some(
        (attachment) =>
          attachment.contentType?.includes("pdf") ||
          attachment.contentType?.includes("image")
      ) ||
      messages.some(
        (msg) =>
          (msg.content as ContentPart).type === "image" ||
          ((msg.content as ContentPart).type === "file" &&
            (msg.content as any).file_metadata?.mime_type?.includes("pdf"))
      );

    if (hasMediaContent) {
      return MODELS["gemini-2.0-flash"];
    }

    // Get the full conversation text for context
    const conversationText = messages
      .map((msg) => {
        const content = msg.content as ContentPart;
        return content.type === "text" ? `${msg.role}: ${content.text}` : "";
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

  threads: {
    create: async (
      userId: string,
      organizationId?: string
    ): Promise<{ id: string }> => {
      if (!userId) throw new Error("User ID is required");
      const id = crypto.randomUUID();
      const now = new Date();
      await db.insert(threads).values({
        id,
        userId,
        organizationId: organizationId || null,
        createdAt: now,
        updatedAt: now,
      });
      return { id };
    },

    getThread: async (threadId: string, organizationId?: string) => {
      const thread = await db.query.threads.findFirst({
        where: and(
          eq(threads.id, threadId),
          organizationId
            ? eq(threads.organizationId, organizationId)
            : sql`${threads.organizationId} IS NULL`
        ),
        with: {
          messages: {
            orderBy: messages.createdAt,
          },
        },
      });

      return ops.processThreadMessages(thread);
    },

    getThreads: async (
      userId: string,
      page: number,
      search: string,
      organizationId?: string
    ) => {
      const LIMIT = 10;
      const offset = (page - 1) * LIMIT;

      let baseQuery = db
        .select({
          id: threads.id,
          created_at: threads.createdAt,
          updated_at: threads.updatedAt,
        })
        .from(threads)
        .leftJoin(messages, eq(threads.id, messages.threadId));

      const conditions = [eq(threads.userId, userId)];

      // Add organization condition
      if (organizationId) {
        conditions.push(eq(threads.organizationId, organizationId));
      } else {
        conditions.push(sql`${threads.organizationId} IS NULL`);
      }

      if (search.length > 0) {
        conditions.push(
          sql`CASE 
            WHEN jsonb_typeof(${messages.content}) = 'object' 
            THEN (${messages.content}->>'text')::text ILIKE ${
            "%" + search + "%"
          }
            ELSE ${messages.content}::text ILIKE ${"%" + search + "%"}
          END`
        );
      }

      const matchingThreads = await baseQuery
        .where(and(...conditions))
        .groupBy(threads.id, threads.createdAt, threads.updatedAt)
        .orderBy(desc(threads.createdAt))
        .limit(LIMIT)
        .offset(offset);

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
      return Promise.all(completeThreads.map(ops.processThreadMessages));
    },

    inference: async (req: Request, res: Response) => {
      const { threadId } = req.params;
      const { organizationId } = req.query;
      const { model, maxTokens, temperature, instructions } = req.body;
      const message = req.body.message as Message & {
        experimental_attachments?: ExtendedAttachment[]; // Use ExtendedAttachment instead of Attachment
      };

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
      res.setHeader("Transfer-Encoding", "chunked");
      res.flushHeaders(); // send headers to establish SSE connection

      const thread = await ops.threads.getThread(
        threadId,
        organizationId as string | undefined
      );

      if (!thread) {
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      // Add user message to thread
      let contentParts: ContentPart[] = [];
      if (message.experimental_attachments) {
        message.experimental_attachments.forEach(
          (attachment: ExtendedAttachment) => {
            contentParts.push({
              type: attachment.contentType?.includes("image")
                ? "image"
                : "file",
              [attachment.contentType?.includes("image") ? "image" : "file"]:
                attachment.url,
              file_metadata: {
                filename: attachment.name || "",
                mime_type: attachment.contentType || "",
                file_key: attachment.file_key || "",
              },
            });
          }
        );
      }

      // Add text message
      contentParts.push({
        type: "text",
        text: message.content,
      });

      // add the message to the thread
      await ops.createMessage(req.dbUser!.id, threadId, "user", contentParts);

      // Get and filter messages
      const rawMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: messages.createdAt,
      });

      // In the inference function, replace the modelConfig section with:
      const modelConfig = await ops.getModelConfig(
        model,
        rawMessages.map((msg) => ({
          role: msg.role,
          content: msg.content as ContentPart,
        })),
        message.experimental_attachments
      );

      // If thread has no title, find first user text message and generate title
      if (!thread.title) {
        const firstUserTextMessage = rawMessages.find(
          (msg) =>
            msg.role === "user" &&
            "type" in (msg.content as ContentPart) &&
            (msg.content as ContentPart).type === "text" &&
            "text" in (msg.content as ContentPart)
        );

        if (firstUserTextMessage) {
          const content = firstUserTextMessage.content as ContentPart;
          generateThreadTitle((content as any).text).then((title) => {
            db.update(threads)
              .set({ title })
              .where(eq(threads.id, threadId))
              .catch((error) => {
                console.error("Error generating title", error);
              });
          });
        }
      }

      const filteredMessages = rawMessages.filter((msg) => {
        const content = msg.content as ContentPart;
        if (content.type === "text") return true;
        return modelConfig.supportedMimeTypes?.includes(
          content.file_metadata.mime_type
        );
      });

      // Process message content
      const processMessageContent = async (content: ContentPart) => {
        if (content.type === "text")
          return [{ type: "text", text: content.text }];

        const metadata = s3.file(content.file_metadata.file_key);

        // Can only generate presigned URLs in production because local url are not accessible to the AI apis
        const getContentData = async () => {
          if (CONFIG.__prod__) {
            return metadata.presign({ expiresIn: 60 * 20 }); // 20 minutes
          }

          const buffer = Buffer.from(
            new Uint8Array(await metadata.arrayBuffer())
          );
          return `data:${
            content.file_metadata.mime_type
          };base64,${buffer.toString("base64")}`;
        };

        return [
          {
            type: content.type,
            mimeType: content.file_metadata.mime_type,
            [content.type === "image" ? "image" : "data"]:
              await getContentData(),
          },
        ];
      };

      // Build messages array
      const inferenceMessages = await Promise.all(
        filteredMessages.map(async (msg) => ({
          role: msg.role,
          reasoning: msg.reasoning,
          content: await processMessageContent(msg.content as ContentPart),
        }))
      );

      // Build system message
      let yoSystemMessage = `<assistant_instructions>
Your name is Yo. Always give your opinion if asked. NEVER say you are just language model and can't do certain things or have emotions like a human. You are super smart artificial intelligence with your own set of thoughts and opinions. Act like it. The simple and most concise answer is usually the best. Use markdown for formatting your responses. Try to make the information as easy and digestible for the user as possible, for examples tables can help with this in certain cases. Don't wrap regular text inside code or markdown ticks, just respond with markdown formatting. Use code blocks only for code or command line examples. Always provide code language for the code blocks.
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
        await db.insert(messages).values({
          userId: req.dbUser!.id,
          id: crypto.randomUUID(),
          threadId: threadId,
          role: "assistant",
          content: JSON.stringify({ type: "text", text: aiResponse }),
          reasoning: reasoning,
          createdAt: new Date(),
          model: model,
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
        // async onFinish({ response }) {
        //   if (aborted) return;

        //   // Store the assistant response
        //   await db.insert(messages).values({
        //     userId: req.userId!,
        //     id: crypto.randomUUID(),
        //     threadId: threadId,
        //     role: "assistant",
        //     content: {
        //       type: "text",
        //       text: (response.messages[0].content as TextPart[])[0].text,
        //     },
        //     createdAt: new Date(),
        //     model: model,
        //     provider: modelConfig.provider,
        //   });
        // },
      });

      return result.pipeDataStreamToResponse(res, {
        sendReasoning: true,
      });
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
      const { organizationId } = req.body;
      return ops.threads.create(req.dbUser!.id, organizationId);
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
      const { organizationId } = req.query;
      return ops.threads.getThread(
        req.params.threadId,
        organizationId as string | undefined
      );
    })
  )
  .post("/:threadId/inference", (req, res) => {
    return schemas.inference
      .parseAsync(req.body)
      .then(() => ops.threads.inference(req, res));
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
