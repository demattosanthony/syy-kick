// External dependencies
import { streamText } from "ai";
import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";
import { Request, Response } from "express";
import { z } from "zod";

// Internal configuration
import db from "../../config/db";
import {
  messageAttachments,
  messages,
  threads,
  toolCalls as toolCallsTable,
} from "../../config/schema";

// Internal features
import { embeddingModel } from "../models";
import { inferenceSchema } from "./threads.schemas";
import { MyMessage, ThreadWithMessages } from "./threads.types";
import {
  createDocumentTool,
  createProjectSearchTool,
  dbMessagesToInferenceMessages,
  getModelConfig,
  maybeGenerateTitle,
  processThreadMessages,
  updateDocumentTool,
} from "./threads.utils";

const threadsOps = {
  async createThread(
    userId: string,
    organizationId?: string,
    projectId?: string
  ) {
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

  /** Creates a new message in DB with optional embedding and attachments. */
  async createMessage(
    userId: string,
    threadId: string,
    role: "system" | "user" | "assistant" | "tool",
    message: MyMessage
  ) {
    const messageId = crypto.randomUUID();
    let embedding = null;

    // Attempt to embed message content
    try {
      const embeddingResult = await embeddingModel.doEmbed({
        values: [message.content as string],
      });
      embedding = embeddingResult.embeddings[0];
    } catch (error) {
      console.error("Error embedding message", error);
    }

    // Insert the message into DB
    await db.insert(messages).values({
      userId,
      id: messageId,
      threadId,
      role,
      text: (message.content as string) ?? null,
      embedding,
      createdAt: new Date(),
    });

    // Insert attachments if any
    if (message.experimental_attachments?.length) {
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
    return { message: "Message created successfully" };
  },

  async getThread(threadId: string) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        messages: {
          orderBy: messages.createdAt,
          columns: {
            embedding: false,
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
            toolCalls: true,
          },
        },
        project: true,
        organization: true,
      },
    });
    if (!thread) return null;

    // Cast the thread to match ThreadWithMessages type
    const typedThread: ThreadWithMessages = {
      ...thread,
      messages: thread.messages.map((msg) => ({
        ...msg,
        attachments: (msg.attachments || []).map((att) => ({
          ...att,
          fileName: att.fileName || undefined,
          mimeType: att.mimeType || undefined,
          size: att.size || undefined,
        })),
      })),
    };

    // Return the thread with processed attachments
    return processThreadMessages(typedThread);
  },

  async listThreads(
    userId: string,
    page: number,
    search: string,
    organizationId?: string
  ) {
    const LIMIT = 10;
    const offset = (page - 1) * LIMIT;
    const conditions = [eq(threads.userId, userId)];

    if (organizationId) {
      conditions.push(eq(threads.organizationId, organizationId));
    } else {
      // organizationId is null
      conditions.push(sql`${threads.organizationId} IS NULL`);
    }

    let baseQuery;
    if (search?.length > 0) {
      // similarity-based search
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
          max_similarity: sql<number>`MAX(${similarity})`.as("max_similarity"),
        })
        .from(threads)
        .leftJoin(messages, eq(threads.id, messages.threadId))
        .where(and(...conditions))
        .groupBy(threads.id, threads.createdAt, threads.updatedAt)
        .having(sql`MAX(${similarity}) > 0.5`)
        .orderBy(desc(sql`max_similarity`));
    } else {
      // no search
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

    // Retrieve the full objects
    const completeThreads = await db.query.threads.findMany({
      where: (tbl, { and, eq, inArray }) =>
        and(
          eq(tbl.userId, userId),
          organizationId
            ? eq(tbl.organizationId, organizationId)
            : sql`${tbl.organizationId} IS NULL`,
          inArray(
            tbl.id,
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

    // Process attachments for each thread
    const processed = [];
    for (const t of completeThreads) {
      const withProcessed = await processThreadMessages({
        ...t,
        messages: t.messages.map((m) => ({
          ...m,
          attachments: [],
        })),
      });
      processed.push(withProcessed);
    }
    return processed;
  },

  async inference(req: Request, res: Response) {
    try {
      const { threadId } = req.params;
      const { model, maxTokens, instructions, message } = req.body as z.infer<
        typeof inferenceSchema
      >;

      // SSE Setup
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Transfer-Encoding", "chunked");
      res.flushHeaders();

      // 1) Fetch thread
      const thread = await threadsOps.getThread(threadId);
      if (!thread) {
        console.error("Thread not found");
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      // 2) Add the user message to DB
      if (message) {
        await threadsOps.createMessage(req.dbUser!.id, threadId, "user", {
          content: message.content || "",
          experimental_attachments: message.experimental_attachments as any,
          role: message.role as any,
        });
      }

      // 3) Re-fetch all messages from DB to build inference context
      const rawMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: messages.createdAt,
        with: { attachments: true, toolCalls: true },
      });

      // 4) Determine appropriate model
      const modelConfig = await getModelConfig(model);

      // 6) Prepare messages for inference
      const inferenceMsgs = await dbMessagesToInferenceMessages(
        rawMessages,
        modelConfig,
        thread.project,
        instructions && instructions.length > 0 ? instructions : undefined
      );

      //   console.log("Inference messages:", inferenceMsgs);

      // 5) Generate a thread title if missing
      await maybeGenerateTitle(threadId, inferenceMsgs, thread.title);

      // 7) Create tools for the assistant if project ID exists
      let tools = {
        create_document: createDocumentTool(),
        update_document: updateDocumentTool(),
        ...(thread.projectId && {
          search_project_information: createProjectSearchTool(
            thread.projectId,
            modelConfig
          ),
        }),
      };

      // Start the streaming from the AI
      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.45,
        tools: tools ? tools : undefined,
        maxSteps: tools ? 8 : undefined,
        toolChoice: "auto",
        toolCallStreaming: true,
        maxTokens: maxTokens,
        providerOptions: {
          ...(model === "claude-3.7-sonnet-thinking" && !tools
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 30000 },
                },
              }
            : {}),
        },
        onStepFinish: async ({
          toolCalls,
          toolResults,
          text,
          finishReason,
          reasoning,
        }) => {
          //   console.log("Tool calls:", toolCalls);
          //   console.log("Tool results:", toolResults.length);
          //   console.log("Finish reason:", finishReason);
          //   console.log("Text:", text);
          //   console.log("Reasoning:", reasoning);

          //   console.log("\n\n\n");

          if (finishReason === "tool-calls") {
            // First create a message for the assistant's tool call
            const toolCallMessage = await db
              .insert(messages)
              .values({
                userId: req.dbUser!.id,
                threadId,
                role: "assistant",
                text,
                reasoning,
                model,
                provider: modelConfig.provider,
              })
              .returning();

            // Then persist each tool call and its result
            for (const toolCall of toolCalls) {
              if (!toolCall) continue;
              const toolCallId = crypto.randomUUID();
              await db.insert(toolCallsTable).values({
                id: toolCallId,
                messageId: toolCallMessage[0].id,
                toolName: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                args: toolCall.args,
                status: "pending",
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              // Find matching result for this tool call
              const result = toolResults.find(
                (r) => r.toolCallId === toolCall.toolCallId
              );

              if (
                result &&
                toolCall.toolName === "search_project_information"
              ) {
                await db
                  .update(toolCallsTable)
                  .set({
                    status: "completed",
                    result: {
                      docs: (result.result as any).docs,
                      images:
                        (result.result as any).images?.map((image: any) => ({
                          fileKey: image.fileKey,
                          mimeType: image.mimeType,
                        })) || [],
                    },
                    updatedAt: new Date(),
                  })
                  .where(eq(toolCallsTable.toolCallId, toolCall.toolCallId));
              } else if (result && toolCall.toolName === "create_document") {
                console.log("Document tool result:", result.result);

                await db.update(toolCallsTable).set({
                  status: "completed",
                  result: result.result,
                  updatedAt: new Date(),
                });
              }
            }

            return;
          }

          // Create a message for the assistant's response
          if (finishReason === "stop" && text) {
            let embedding = null;
            if (text && text.length > 0) {
              try {
                const embeddingResult = await embeddingModel.doEmbed({
                  values: [text],
                });
                embedding = embeddingResult.embeddings[0];
              } catch (error) {
                console.error("Error embedding message", error);
              }
            }

            // Persist the assistant's response
            await db.insert(messages).values({
              userId: req.dbUser!.id,
              id: crypto.randomUUID(),
              threadId,
              role: "assistant",
              text: text,
              reasoning,
              createdAt: new Date(),
              model,
              embedding: embedding,
              provider: modelConfig.provider,
            });
            return;
          }
        },
      });

      // Pipe the data out as SSE
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

  async deleteThread(
    userId: string,
    threadId: string,
    organizationId?: string
  ) {
    // First delete messages
    await db
      .delete(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.userId, userId)));

    // Then delete the thread
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
};

export default threadsOps;
