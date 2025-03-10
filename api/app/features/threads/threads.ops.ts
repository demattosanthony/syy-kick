// External dependencies
import { streamText } from "ai";
import { and, cosineDistance, desc, eq, inArray, or, sql } from "drizzle-orm";
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
  createProjectSearchTool,
  dbMessagesToInferenceMessages,
  getModelConfig,
  maybeGenerateTitle,
  processThreadMessages,
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
    message: MyMessage,
    parentMessageId?: string
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
      parentMessageId,
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
    return { message: "Message created successfully", messageId };
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
            parentMessageId: true,
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
            children: {
              columns: {
                embedding: false,
                id: true,
                threadId: true,
                userId: true,
                parentMessageId: true,
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
        children: msg.children || [],
      })),
    };
    // console.log("Thread:", typedThread);

    // Return the thread with processed attachments
    return processThreadMessages(typedThread);
  },

  async updateThread(
    threadId: string,
    userId: string,
    data: { isPublic?: boolean; projectId?: string; title?: string }
  ) {
    const updateData: any = {
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      ...(data.projectId !== undefined && { projectId: data.projectId }),
      ...(data.title !== undefined && { title: data.title }),
      updatedAt: new Date(),
    };

    if (Object.keys(updateData).length === 1) {
      // Only updatedAt exists
      return { message: "No changes to update" };
    }

    await db
      .update(threads)
      .set(updateData)
      .where(eq(threads.id, threadId))
      .returning();

    return { message: "Thread updated successfully" };
  },

  async listThreads(
    userId: string,
    page: number,
    search: string,
    organizationId?: string,
    projectId?: string
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

    // Add project filtering if projectId is provided
    if (projectId) {
      conditions.push(eq(threads.projectId, projectId));
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
      const { model, maxTokens, instructions, message, parentMessageId } =
        req.body as z.infer<typeof inferenceSchema>;
      console.log("parentMessageId", parentMessageId);

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
      let newMessageId: string | undefined;
      if (message) {
        const result = await threadsOps.createMessage(
          req.dbUser!.id,
          threadId,
          "user",
          {
            content: message.content || "",
            experimental_attachments: message.experimental_attachments as any,
            role: message.role as any,
          },
          parentMessageId
        );
        newMessageId = result.messageId;
      }

      // 3) Re-fetch messages from DB to build inference context
      // If parentMessageId is provided, only fetch messages in that branch
      // Otherwise, fetch all messages in the thread
      let rawMessages: any[] = [];

      if (parentMessageId) {
        // Get the conversation branch by starting from the parent message
        // and collecting all messages in the path from root to that message,
        // plus any direct children of those messages

        // First, build the path from the parent message to the root
        const messagePath = new Set<string>();
        let currentId: string | null = parentMessageId;

        while (currentId) {
          messagePath.add(currentId);

          const currentMessage: { parentMessageId: string | null } | undefined =
            await db.query.messages.findFirst({
              where: eq(messages.id, currentId),
              columns: { parentMessageId: true },
            });

          currentId = currentMessage?.parentMessageId || null;
        }

        // Now fetch all messages in this conversation branch:
        // 1. All messages in the path from root to parent
        // 2. All direct children of any message in that path
        rawMessages = await db.query.messages.findMany({
          where: and(
            eq(messages.threadId, threadId),
            or(
              // Messages that are part of the path from root to parent
              inArray(messages.id, Array.from(messagePath)),
              // Direct children of any message in the path
              inArray(messages.parentMessageId, Array.from(messagePath))
            )
          ),
          orderBy: messages.createdAt,
          with: { attachments: true, toolCalls: true },
        });
      } else {
        // If no parentMessageId, get all messages in the thread
        rawMessages = await db.query.messages.findMany({
          where: eq(messages.threadId, threadId),
          orderBy: messages.createdAt,
          with: { attachments: true, toolCalls: true },
        });
      }

      console.log("Raw messages:", rawMessages);

      // 4) Determine appropriate model
      const modelConfig = await getModelConfig(model);

      // 6) Prepare messages for inference
      const inferenceMsgs = await dbMessagesToInferenceMessages(
        rawMessages,
        modelConfig,
        thread.project,
        instructions && instructions.length > 0 ? instructions : undefined
      );

      // console.log("Inference messages:", inferenceMsgs);

      // 5) Generate a thread title if missing
      await maybeGenerateTitle(threadId, inferenceMsgs, thread.title);

      // 7) Create tools for the assistant if project ID exists
      let tools = thread.projectId
        ? {
            search_project_information: createProjectSearchTool(
              thread.projectId,
              modelConfig
            ),
          }
        : undefined;

      // Start the streaming from the AI
      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.4,
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
                parentMessageId: newMessageId,
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
                (toolCall.toolName === "search_project_information" ||
                  toolCall.toolName === "search_documents")
              ) {
                console.log("Project search tool result:", toolCall);
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
              } else if (result) {
                console.log("Document tool result:", toolCall);

                await db
                  .update(toolCallsTable)
                  .set({
                    status: "completed",
                    result: result.result,
                    updatedAt: new Date(),
                  })
                  .where(eq(toolCallsTable.toolCallId, toolCall.toolCallId));
              }
            }

            return;
          }

          // Create a message for the assistant's response
          if ((finishReason === "stop" || finishReason === "length") && text) {
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
              parentMessageId: newMessageId,
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

  async editMessage(
    userId: string,
    threadId: string,
    originalMessageId: string,
    newContent: string,
    attachments?: any[]
  ) {
    console.log("Editing message:", originalMessageId);
    console.log("New content:", newContent);
    // 1. Verify the original message exists and belongs to this thread
    const originalMessage = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, originalMessageId),
        eq(messages.threadId, threadId)
      ),
    });

    if (!originalMessage) {
      throw new Error("Original message not found in this thread");
    }

    // 2. Create a new message that points to the parent of the original message
    // This creates a new branch in the conversation
    const newMessageId = crypto.randomUUID();
    let embedding = null;

    console.log("New message id:", newMessageId);

    // Attempt to embed the new content
    try {
      const embeddingResult = await embeddingModel.doEmbed({
        values: [newContent],
      });
      embedding = embeddingResult.embeddings[0];
    } catch (error) {
      console.error("Error embedding edited message", error);
    }

    // Insert the new message
    await db.insert(messages).values({
      userId,
      id: newMessageId,
      threadId,
      role: originalMessage.role,
      parentMessageId: originalMessage.parentMessageId, // Point to same parent as original
      text: newContent,
      embedding,
      createdAt: new Date(),
    });

    // 3. Add any attachments to the new message
    if (attachments?.length) {
      for (const attachment of attachments) {
        await db.insert(messageAttachments).values({
          messageId: newMessageId,
          fileName: attachment.name,
          mimeType: attachment.contentType,
          fileKey: attachment.file_key,
          type: attachment.contentType?.includes("image") ? "image" : "file",
        });
      }
    }

    return {
      message: "Message edited successfully",
      messageId: newMessageId,
      originalMessageId,
    };
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

  async cloneThread(userId: string, threadId: string) {
    const sourceThread = await threadsOps.getThread(threadId);
    if (!sourceThread) {
      throw new Error("Thread not found");
    }

    // Create a new thread with all properties from source thread
    const [newThread] = await db
      .insert(threads)
      .values({
        userId,
        organizationId: sourceThread.organizationId,
        projectId: sourceThread.organizationId
          ? sourceThread.projectId
          : undefined, // Only clone project if it's part of the same organization, as the user can only clone a thread if they have access to the project. So both users have access to the project.
        isPublic: false, // Always set cloned threads to private initially
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Fetch original messages with embeddings
    const originalMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, threadId),
      orderBy: messages.createdAt,
      with: { attachments: true, toolCalls: true },
    });

    // Clone all messages with embeddings
    const messagesToCopy = originalMessages.map((msg) => ({
      userId,
      threadId: newThread.id,
      role: msg.role,
      text: msg.text || "",
      reasoning: msg.reasoning || null,
      model: msg.model || null,
      provider: msg.provider || null,
      embedding: msg.embedding, // Copy embedding for search functionality
      createdAt: new Date(),
    }));

    // Insert all messages first to get their IDs
    const insertedMessages = [];
    for (const msg of messagesToCopy) {
      const [insertedMsg] = await db
        .insert(messages)
        .values({
          ...msg,
          id: crypto.randomUUID(),
        })
        .returning();

      insertedMessages.push(insertedMsg);
    }

    // Now handle attachments and tool calls for each message
    for (let i = 0; i < sourceThread.messages.length; i++) {
      const sourceMsg = sourceThread.messages[i];
      const newMsg = insertedMessages[i];

      // Clone attachments
      if (sourceMsg.attachments && sourceMsg.attachments.length > 0) {
        for (const att of sourceMsg.attachments) {
          await db.insert(messageAttachments).values({
            messageId: newMsg.id,
            fileName: att.fileName || null,
            mimeType: att.mimeType || null,
            fileKey: att.fileKey,
            type: att.type || null,
            size: att.size || null,
          });
        }
      }

      // Clone tool calls
      if (sourceMsg.toolCalls && sourceMsg.toolCalls.length > 0) {
        for (const call of sourceMsg.toolCalls) {
          await db.insert(toolCallsTable).values({
            id: crypto.randomUUID(), // Generate new ID for tool call
            messageId: newMsg.id,
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            args: call.args,
            status: call.status as any,
            result: call.result,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    return { id: newThread.id };
  },
};

export default threadsOps;
