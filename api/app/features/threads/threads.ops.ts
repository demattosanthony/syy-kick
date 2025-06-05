// External dependencies
import { streamText } from "ai";
import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";
import { Request, Response } from "express";
import { EventEmitter } from "events";

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
import { MyMessage } from "./threads.types";
import {
  createWebSearchTool,
  dbMessagesToInferenceMessages,
  getModelConfig,
  processThreadMessages,
  processAttachments,
  createAndSaveThreadTitle,
} from "./threads.utils";
import { FilePage, markitdown } from "../../doc-processor-v2";
import s3 from "../../config/s3";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { MicrosoftAPI } from "../../config/microsoft";
import { createSharepointToolSet } from "../tools/tool-definitions";
import { MARKITDOWN_MIME_TYPES } from "../../config/constants";
import { Workspace } from "../auth/auth.types";

const eventEmitter = new EventEmitter();

// In-memory cache for active streams
interface ActiveStreamData {
  currentAssistantMessageId: string | null;
  accumulatedResponseText: string;
  assistantMessageCreatedAt: Date | null;
  role: "assistant"; // Typically always assistant for this cache
  model?: string;
  provider?: string;
}
const activeStreamCache = new Map<string, ActiveStreamData>();

// In-memory cache for abort controllers
const abortControllers = new Map<string, AbortController>();

const threadsOps = {
  async createThread(
    userId: string,
    organizationId?: string,
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
        let filePage: FilePage | null = null;
        if (MARKITDOWN_MIME_TYPES.includes(attachment.contentType!)) {
          const attachmentBuffer = await s3
            .file(attachment.file_key)
            .arrayBuffer();
          filePage = await markitdown(
            Buffer.from(attachmentBuffer),
            attachment.name || ""
          );
        }

        const markdownContent = filePage?.chunks
          .map((chunk) => chunk.content)
          .join("\n");

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
          markdown: markdownContent,
        });
      }
    }
    return { message: "Message created successfully" };
  },

  async getThread(threadId: string) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        organization: true,
        knowledgeBase: true,
      },
    });
    if (!thread) return null;

    return thread;
  },

  async getThreadMessages(threadId: string) {
    const threadMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, threadId),
      orderBy: messages.createdAt,
      with: {
        attachments: true,
        toolCalls: true,
      },
    });

    // Process attachments for each message to add URLs
    const processedMessages = [];
    for (const msg of threadMessages) {
      // Map database attachments to MessageAttachment type
      const mappedAttachments = msg.attachments.map((att) => ({
        ...att,
        fileName: att.fileName || undefined,
        mimeType: att.mimeType || undefined,
        size: att.size || undefined,
      }));

      const processedAttachments = await processAttachments(mappedAttachments);
      processedMessages.push({
        ...msg,
        attachments: processedAttachments,
      });
    }

    return processedMessages;
  },

  async updateThread(
    threadId: string,
    userId: string,
    data: { isPublic?: boolean; title?: string }
  ) {
    const updateData: any = {
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
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
    pageSize: number,
    search: string,
    organizationId?: string,
    knowledgeBaseId?: string,
    workflowId?: string
  ) {
    const LIMIT = pageSize || 10;
    const offset = (page - 1) * LIMIT;
    const conditions = [eq(threads.userId, userId)];

    if (organizationId) {
      conditions.push(eq(threads.organizationId, organizationId));
    } else {
      // organizationId is null
      conditions.push(sql`${threads.organizationId} IS NULL`);
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

  async postMessageAndStartInference(
    userId: string,
    threadId: string,
    message: any,
    model: string,
    maxTokens?: number,
    instructions?: string,
    workspace?: Workspace
  ) {
    // 1) Store the user message
    if (message) {
      await threadsOps.createMessage(userId, threadId, "user", {
        content: message.content || "",
        experimental_attachments: message.experimental_attachments as any,
        role: message.role as any,
      });
    }

    // 2) Start inference asynchronously (don't await)
    setImmediate(async () => {
      try {
        await threadsOps.runInferenceForThread(
          userId,
          threadId,
          model,
          maxTokens,
          instructions,
          workspace
        );
      } catch (error) {
        console.error("Error during background inference:", error);
        // Clean up cache if background inference setup fails
        activeStreamCache.delete(threadId);
        abortControllers.delete(threadId);
      }
    });

    return { success: true };
  },

  async stopInference(threadId: string) {
    const controller = abortControllers.get(threadId);
    if (controller) {
      console.log(`Aborting inference for thread ${threadId}`);
      controller.abort();

      // Emit an event to notify clients that inference was stopped
      eventEmitter.emit(`thread-${threadId}-message`, {
        type: "inference-stopped",
      });

      return { success: true, stopped: true };
    }
    return { success: true, stopped: false };
  },

  async runInferenceForThread(
    userId: string,
    threadId: string,
    model: string,
    maxTokens?: number,
    instructions?: string,
    workspace?: Workspace
  ) {
    const controller = new AbortController();
    let inferenceCompleteEmitted = false;

    // Store the abort controller so it can be accessed from the stop endpoint
    abortControllers.set(threadId, controller);

    // Helper function to emit inference complete event only once
    const emitInferenceComplete = () => {
      if (!inferenceCompleteEmitted) {
        inferenceCompleteEmitted = true;
        eventEmitter.emit(`thread-${threadId}-message`, {
          type: "inference-complete",
        });
      }
    };

    // Cleanup function to remove abort controller and cache
    const cleanup = () => {
      abortControllers.delete(threadId);
      activeStreamCache.delete(threadId);
    };

    // Track the current step's message state
    let currentStepState: ActiveStreamData = {
      currentAssistantMessageId: null,
      accumulatedResponseText: "",
      assistantMessageCreatedAt: null,
      role: "assistant",
      model: model,
      provider: undefined,
    };

    try {
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
        with: {
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
      });
      const modelConfig = getModelConfig(model);
      currentStepState.provider = modelConfig.provider;

      if (!thread) {
        console.error(`Thread not found: ${threadId}`);
        cleanup();
        return;
      }

      const inferenceMsgs = await dbMessagesToInferenceMessages(
        thread.messages,
        modelConfig,
        { id: userId } as any,
        instructions && instructions.length > 0 ? instructions : undefined
      );

      if (!thread.title) {
        createAndSaveThreadTitle(threadId, inferenceMsgs);
      }

      let tools: Record<string, any> | undefined = undefined;
      if (modelConfig.supportsToolUse) {
        tools = { web_search: createWebSearchTool() };

        // Check if user has Microsoft Graph access and add SharePoint tools
        const microsoftGraph = new MicrosoftAPI({ userId: userId });
        const accessToken = await microsoftGraph.getAccessToken("graph");
        if (accessToken) {
          const sharepointTools = createSharepointToolSet(userId, db);
          tools = { ...tools, ...sharepointTools };
        }
      }

      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.45,
        ...(tools && {
          tools: tools,
          maxSteps: 25,
          toolChoice: "auto",
          toolCallStreaming: true,
        }),
        maxTokens: maxTokens,
        abortSignal: controller.signal,
        providerOptions: {
          openai: {
            store: false,
            reasoningSummary: "auto",
          },
          ...(modelConfig.provider === "anthropic" &&
          (modelConfig.model.modelId.includes("claude-3-7") ||
            modelConfig.model.modelId.includes("claude-4"))
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 24_000 },
                },
              }
            : {}),
          google: {
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: 24_000,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
        onChunk: async ({ chunk }) => {
          // Helper function to ensure we have a message for this step
          const ensureAssistantMessage = async () => {
            if (!currentStepState.currentAssistantMessageId) {
              currentStepState.assistantMessageCreatedAt = new Date();
              const [insertedMessage] = await db
                .insert(messages)
                .values({
                  userId: userId,
                  id: crypto.randomUUID(),
                  threadId,
                  role: "assistant",
                  text: "",
                  createdAt: currentStepState.assistantMessageCreatedAt,
                  model: currentStepState.model,
                  provider: currentStepState.provider,
                })
                .returning();
              currentStepState.currentAssistantMessageId = insertedMessage.id;
              currentStepState.accumulatedResponseText = "";

              // Update cache and emit initial event
              activeStreamCache.set(threadId, currentStepState);
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "text-delta",
                messageId: currentStepState.currentAssistantMessageId,
                content: "",
                role: "assistant",
                createdAt:
                  currentStepState.assistantMessageCreatedAt.toISOString(),
                isInitialChunk: true,
              });
            }
          };

          if (chunk.type === "text-delta") {
            // Ensure we have a message for this step
            await ensureAssistantMessage();

            // Accumulate the text delta
            currentStepState.accumulatedResponseText += chunk.textDelta;

            // Emit the delta event
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "text-delta",
              messageId: currentStepState.currentAssistantMessageId,
              content: chunk.textDelta,
            });

            // Update cache with the latest accumulated text
            activeStreamCache.set(threadId, currentStepState);
          } else if (chunk.type === "reasoning") {
            // Ensure we have a message for reasoning content
            await ensureAssistantMessage();

            // Handle reasoning chunks (for models that support thinking)
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "reasoning-delta",
              messageId: currentStepState.currentAssistantMessageId,
              content: chunk.textDelta,
            });
          } else if (chunk.type === "source") {
            // Handle source chunks
            if (currentStepState.currentAssistantMessageId) {
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "source",
                messageId: currentStepState.currentAssistantMessageId,
                source: chunk.source,
              });
            }
          } else if (chunk.type === "tool-call") {
            // For tool calls, we need a message to associate them with
            await ensureAssistantMessage();

            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-call-chunk",
              messageId: currentStepState.currentAssistantMessageId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: chunk.args,
            });
          } else if (chunk.type === "tool-call-streaming-start") {
            // Handle start of streaming tool call
            if (currentStepState.currentAssistantMessageId) {
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call-streaming-start",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
              });
            }
          } else if (chunk.type === "tool-call-delta") {
            // Handle streaming tool call argument deltas
            if (currentStepState.currentAssistantMessageId) {
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call-delta",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                argsTextDelta: chunk.argsTextDelta,
              });
            }
          } else if (chunk.type === "tool-result") {
            // Handle tool execution results
            if (currentStepState.currentAssistantMessageId) {
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-result",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
                result: chunk.result,
              });
            }
          }
        },
        onError: (error) => {
          console.error(
            `Error running inference for thread ${threadId}:`,
            error
          );

          // Check if this was an abort
          if (
            error.error instanceof Error &&
            error.error.name === "AbortError"
          ) {
            console.log(`Inference aborted for thread ${threadId}`);
            // Save accumulated text if we have any
            if (
              currentStepState.currentAssistantMessageId &&
              currentStepState.accumulatedResponseText
            ) {
              db.update(messages)
                .set({ text: currentStepState.accumulatedResponseText })
                .where(
                  eq(messages.id, currentStepState.currentAssistantMessageId)
                )
                .catch((err) =>
                  console.error("Error saving aborted message:", err)
                );
            }
          }

          cleanup();
          // Emit inference complete event on error so frontend doesn't get stuck
          emitInferenceComplete();
        },
        onStepFinish: async ({
          toolCalls,
          toolResults,
          text,
          finishReason,
          reasoning,
        }) => {
          const now = new Date();

          // If we have a current message from this step, finalize it
          if (currentStepState.currentAssistantMessageId) {
            const currentMsgId = currentStepState.currentAssistantMessageId;
            const fullAccumulatedText =
              currentStepState.accumulatedResponseText;

            // Persist the final accumulated text and reasoning to DB
            await db
              .update(messages)
              .set({
                text: fullAccumulatedText,
                reasoning,
              })
              .where(eq(messages.id, currentMsgId));

            // Handle tool calls for this step
            if (toolCalls && toolCalls.length > 0) {
              for (const toolCall of toolCalls) {
                if (!toolCall) continue;
                const toolCallDbId = crypto.randomUUID();
                await db.insert(toolCallsTable).values({
                  id: toolCallDbId,
                  messageId: currentMsgId,
                  toolName: toolCall.toolName,
                  toolCallId: toolCall.toolCallId,
                  args: toolCall.args,
                  status: "pending",
                  createdAt: now,
                  updatedAt: now,
                });
                const result = toolResults.find(
                  (r) => r.toolCallId === toolCall.toolCallId
                );
                if (result) {
                  await db
                    .update(toolCallsTable)
                    .set({
                      status: "completed",
                      result: result.result,
                      updatedAt: now,
                    })
                    .where(eq(toolCallsTable.id, toolCallDbId));
                }
              }

              const assistantMessageWithTools =
                await db.query.messages.findFirst({
                  where: eq(messages.id, currentMsgId),
                  with: { toolCalls: true },
                });
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call",
                message: assistantMessageWithTools,
              });
            }

            // Handle embeddings for text content
            if (fullAccumulatedText && fullAccumulatedText.length > 0) {
              try {
                const embeddingResult = await embeddingModel.doEmbed({
                  values: [fullAccumulatedText],
                });
                await db
                  .update(messages)
                  .set({ embedding: embeddingResult.embeddings[0] })
                  .where(eq(messages.id, currentMsgId));
              } catch (error) {
                console.error("Error embedding step message", error);
              }
            }

            // Emit message complete event for this step
            const finalStepMessage = await db.query.messages.findFirst({
              where: eq(messages.id, currentMsgId),
              with: { attachments: true, toolCalls: true },
            });
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "message-complete",
              message: finalStepMessage,
            });
          }

          // Reset state for the next step (if there is one)
          // If this is the final step (stop/length), we'll clean up in the next condition
          if (finishReason === "tool-calls") {
            // Reset for the next step that will come after tool execution
            currentStepState = {
              currentAssistantMessageId: null,
              accumulatedResponseText: "",
              assistantMessageCreatedAt: null,
              role: "assistant",
              model: model,
              provider: modelConfig.provider,
            };
            activeStreamCache.set(threadId, currentStepState);
          } else if (finishReason === "stop" || finishReason === "length") {
            // This is the final step, clean up
            cleanup();
            // Emit inference complete event so frontend knows the entire run is done
            emitInferenceComplete();
          }
        },
      });

      for await (const _ of result.textStream) {
      }
    } catch (error: any) {
      console.error(
        `Unhandled error in runInferenceForThread for ${threadId}:`,
        error
      );

      // Check if this was an abort
      if (error instanceof Error && error.name === "AbortError") {
        console.log(`Inference aborted for thread ${threadId}`);
        // Save accumulated text if we have any
        if (
          currentStepState.currentAssistantMessageId &&
          currentStepState.accumulatedResponseText
        ) {
          try {
            await db
              .update(messages)
              .set({ text: currentStepState.accumulatedResponseText })
              .where(
                eq(messages.id, currentStepState.currentAssistantMessageId)
              );
          } catch (err) {
            console.error("Error saving aborted message:", err);
          }
        }
      }

      cleanup();
      // Emit inference complete event on unhandled error
      emitInferenceComplete();
    } finally {
      // Ensure cleanup on any exit
      cleanup();
      // Emit inference complete as a final safety net
      emitInferenceComplete();
    }
  },

  async streamMessages(req: Request, res: Response) {
    const { threadId } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write("data: " + JSON.stringify({ type: "connected" }) + "\n\n");

    // Check cache for active stream data on new connection
    const cachedStreamData = activeStreamCache.get(threadId);
    if (cachedStreamData && cachedStreamData.currentAssistantMessageId) {
      console.log(
        `Resuming stream for thread ${threadId} from cache for message ${cachedStreamData.currentAssistantMessageId}`
      );
      res.write(
        "event: message\ndata: " +
          JSON.stringify({
            type: "stream-resume",
            messageId: cachedStreamData.currentAssistantMessageId,
            fullText: cachedStreamData.accumulatedResponseText,
            createdAt:
              cachedStreamData.assistantMessageCreatedAt?.toISOString(),
            role: cachedStreamData.role,
          }) +
          "\n\n"
      );
    }

    const messageHandler = (data: any) => {
      res.write("event: message\ndata: " + JSON.stringify(data) + "\n\n");
    };
    eventEmitter.on(`thread-${threadId}-message`, messageHandler);

    req.on("close", () => {
      console.log(`Client disconnected from thread ${threadId} stream`);
      eventEmitter.removeListener(`thread-${threadId}-message`, messageHandler);
      res.end();
    });
    req.on("aborted", () => {
      console.log(`Client aborted thread ${threadId} stream`);
      eventEmitter.removeListener(`thread-${threadId}-message`, messageHandler);
      res.end();
    });
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
    for (let i = 0; i < originalMessages.length; i++) {
      const sourceMsg = originalMessages[i];
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
