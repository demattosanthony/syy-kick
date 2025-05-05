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
  createKnowledgeBaseSearchTool,
  createProjectSearchTool,
  createWebSearchTool,
  dbMessagesToInferenceMessages,
  getModelConfig,
  maybeGenerateTitle,
  processThreadMessages,
} from "./threads.utils";
import { listKnowledgeBases } from "../knowledge-bases/knowledge-bases.ops";
import { getOrgIdOrUnedfined } from "../../utils";
import { markitdown, markitdownMimeTypes } from "../../doc-processor-v2";
import s3 from "../../config/s3";
import workflowHandlers from "../workflows/workflows.handlers";
import { CONFIG } from "../../config/constants";

const threadsOps = {
  async createThread(
    userId: string,
    organizationId?: string,
    projectId?: string,
    knowledgeBaseId?: string,
    workflowId?: string
  ) {
    if (!userId) throw new Error("User ID is required");
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(threads).values({
      id,
      userId,
      organizationId: organizationId || null,
      projectId: projectId || null,
      knowledgeBaseId: knowledgeBaseId || null,
      workflowId: workflowId || null,
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
        // convert attachment to markdown
        let markdown = null;
        if (markitdownMimeTypes.includes(attachment.contentType!)) {
          const attachmentBuffer = await s3
            .file(attachment.file_key)
            .arrayBuffer();
          markdown = await markitdown(
            Buffer.from(attachmentBuffer),
            attachment.name || ""
          );
        }

        await db.insert(messageAttachments).values({
          messageId,
          fileName: attachment.name,
          mimeType: attachment.contentType,
          fileKey: attachment.file_key,
          type: attachment.contentType?.includes("image")
            ? "image"
            : attachment.contentType?.includes("markdown")
              ? "markdown"
              : "file",
          markdown,
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
        knowledgeBase: true,
      },
    });
    if (!thread) return null;

    // Cast the thread to match ThreadWithMessages type
    const typedThread: ThreadWithMessages = {
      ...thread,
      knowledgeBase: thread.knowledgeBase || undefined,
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
    projectId?: string,
    knowledgeBaseId?: string,
    workflowId?: string
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

    // Add knowledge base filtering if knowledgeBaseId is provided
    if (knowledgeBaseId) {
      conditions.push(eq(threads.knowledgeBaseId, knowledgeBaseId));
    }

    if (workflowId) {
      conditions.push(eq(threads.workflowId, workflowId));
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
        .having(
          and(
            sql`COUNT(${messages.id}) > 0`, // Filter out empty threads
            sql`MAX(${similarity}) > 0.5` // Keep existing similarity condition
          )
        )
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
        .having(sql`COUNT(${messages.id}) > 0`)
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
    const controller = new AbortController();

    // SSE Setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Transfer-Encoding", "chunked");

    // Manually set CORS headers for SSE
    const origin = req.headers.origin;
    if (origin && CONFIG.CORS_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    try {
      const { threadId } = req.params;
      const { model, maxTokens, instructions, message, workflowId } =
        req.body as z.infer<typeof inferenceSchema>;

      // 1) Store the user message
      if (message) {
        await threadsOps.createMessage(req.dbUser!.id, threadId, "user", {
          content: message.content || "",
          experimental_attachments: message.experimental_attachments as any,
          role: message.role as any,
        });
      }

      // 2) Fetch thread and knowledge bases in parallel
      const [thread, knowledgeBases, modelConfig] = await Promise.all([
        db.query.threads.findFirst({
          where: eq(threads.id, threadId),
          with: {
            project: true,
            organization: true,
            knowledgeBase: true,
            messages: {
              with: {
                attachments: true,
                toolCalls: true,
              },
              orderBy: messages.createdAt,
            },
          },
        }),
        listKnowledgeBases(
          req.dbUser!.id,
          getOrgIdOrUnedfined(req.workspace),
          1,
          999
        ),
        Promise.resolve(getModelConfig(model)),
      ]);

      if (!thread) {
        console.error("Thread not found");
        res.status(404).json({ error: "Thread not found" });
        return;
      }

      // 3) Prepare messages for inference
      const inferenceMsgs = await dbMessagesToInferenceMessages(
        thread.messages,
        modelConfig,
        req.dbUser!,
        thread.project || undefined,
        instructions && instructions.length > 0 ? instructions : undefined,
        thread.knowledgeBase || undefined,
        knowledgeBases.data
      );

      //   console.log("Inference messages:", inferenceMsgs);

      // 4) Generate a thread title if missing
      if (!thread.title) {
        maybeGenerateTitle(threadId, inferenceMsgs, thread.title);
      }

      // 5) Create tools for the assistant if model supports it and context requires them
      let tools: Record<string, any> | undefined = undefined;
      if (modelConfig.supportsToolUse) {
        tools = {
          web_search: createWebSearchTool(),
          ...(thread.knowledgeBase === null && {
            search_project_information: createProjectSearchTool(
              modelConfig,
              req.workspace!,
              req.dbUser!,
              thread.projectId || undefined
            ),
          }),
          search_knowledge_base: createKnowledgeBaseSearchTool(
            modelConfig,
            thread.knowledgeBase || undefined
          ),
        };
      }

      let aiResponse = "";
      let requestCompleted = false;

      // Start the streaming from the AI
      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.6,
        // Conditionally pass tool-related parameters only if tools are defined (i.e., supported by the model)
        ...(tools && {
          tools: tools,
          maxSteps: 8,
          toolChoice: "auto",
          toolCallStreaming: true,
        }),
        maxTokens: maxTokens,
        abortSignal: controller.signal,
        providerOptions: {
          openai: {
            store: false,
          },
          ...(modelConfig.provider === "anthropic" &&
          modelConfig.model.modelId.includes("claude-3-7")
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 12_000 },
                },
              }
            : {}),
        },
        onChunk: async ({ chunk }) => {
          if (chunk.type === "text-delta") {
            aiResponse += chunk.textDelta;
          }
        },
        onError: (error) => {
          console.error("Error running inference:", error);
          res.status(500).json({
            error: "An error occurred during inference",
          });
        },
        onFinish: async () => {
          requestCompleted = true;
        },
        onStepFinish: async ({
          toolCalls,
          toolResults,
          text,
          finishReason,
          reasoning,
        }) => {
          //   console.log("Finish reason:", finishReason);
          //   console.log("Tool calls:", toolCalls);
          //   console.log("Tool results:", toolResults);
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

              // Define the tool names that need this unique storage handling
              const projectSearchToolNames = [
                "search_project_information",
                "search_documents",
                "search_knowledge_base",
              ];
              const toolName = toolCall.toolName as string;

              if (result && projectSearchToolNames.includes(toolName)) {
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
            });
            return;
          }
        },
      });

      req.on("close", () => {
        // If the request completed normally, we don't need to do anything
        if (requestCompleted) {
          console.log("Request completed normally");
          return;
        }

        console.log("Client aborted inference");
        try {
          // Abort the controller first
          controller.abort();
        } catch (error) {
          console.error("Error aborting controller:", error);
        }

        // Save the AI response if it's not empty - this will now execute even if abort() throws
        if (aiResponse && aiResponse.trim().length > 0) {
          console.log("Saving partial AI response after client disconnect");
          db.insert(messages)
            .values({
              userId: req.dbUser!.id,
              id: crypto.randomUUID(),
              threadId,
              role: "assistant",
              reasoning: null,
              text: aiResponse,
              createdAt: new Date(),
              model,
              embedding: null,
              provider: modelConfig.provider,
            })
            .then(() => console.log("Successfully saved partial response"))
            .catch((err) =>
              console.error("Failed to save partial response:", err)
            );
        } else {
          console.log("No AI response to save after client disconnect");
        }
      });

      // Pipe the data out as SSE
      const streamResult = result.pipeDataStreamToResponse(res, {
        sendReasoning: true,
        sendSources: true,
      });

      return streamResult;
    } catch (error: any) {
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
