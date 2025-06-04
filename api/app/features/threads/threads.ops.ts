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
import {
  createSharepointListTool,
  createSharepointSearchTool,
  openSharepointFileTool,
} from "../tools/tool-definitions";
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
      }
    });

    return { success: true };
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
    // Initialize local state for this specific inference run
    let runState: ActiveStreamData = {
      currentAssistantMessageId: null,
      accumulatedResponseText: "",
      assistantMessageCreatedAt: null,
      role: "assistant",
      model: model,
      provider: undefined, // Will be set from modelConfig
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
      runState.provider = modelConfig.provider;

      if (!thread) {
        console.error(`Thread not found: ${threadId}`);
        activeStreamCache.delete(threadId); // Clean up cache
        return;
      }

      // Associate this run's state with the threadId in the global cache
      // This allows streamMessages to potentially pick it up on reconnect
      activeStreamCache.set(threadId, runState);

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
        const microsoftGraph = new MicrosoftAPI({ userId: userId });
        const accessToken = await microsoftGraph.getAccessToken("graph");
        if (accessToken) {
          const graphClient = await microsoftGraph.getGraphClient("graph");
          let driveId: string | undefined = undefined;
          if (graphClient) {
            try {
              const drive = await graphClient.api("/me/drive").get();
              driveId = drive?.id;
            } catch (error) {
              console.error("Failed to get drive ID:", error);
            }
          }
          if (driveId && graphClient) {
            tools.sharepoint_graph = createSharepointSearchTool(
              driveId,
              graphClient
            );
            tools.sharepoint_ls = createSharepointListTool(
              driveId,
              graphClient
            );
            tools.sharepoint_open_file = openSharepointFileTool(
              driveId,
              graphClient,
              db
            );
          }
        }
      }

      const result = streamText({
        model: modelConfig.model,
        messages: inferenceMsgs,
        temperature: 0.45,
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
          if (chunk.type === "text-delta") {
            const cachedRunState = activeStreamCache.get(threadId);
            if (!cachedRunState) {
              // Should ideally not happen if set at start of run
              console.warn(
                `Cache miss for thread ${threadId} during onChunk. Re-initializing minimally.`
              );
              // This is a fallback, ideally the cache is always present during an active run.
              // This minimal re-init won't have the original createdAt or message ID if it was already set.
              activeStreamCache.set(threadId, {
                currentAssistantMessageId: null, // Cannot recover old ID here
                accumulatedResponseText: chunk.textDelta,
                assistantMessageCreatedAt: new Date(), // Best guess for createdAt
                role: "assistant",
                model: model,
                provider: modelConfig.provider,
              });
            }
            const currentRunState = activeStreamCache.get(threadId)!; // Assert non-null after check/set

            if (!currentRunState.currentAssistantMessageId) {
              currentRunState.assistantMessageCreatedAt = new Date();
              const [insertedMessage] = await db
                .insert(messages)
                .values({
                  userId: userId,
                  id: crypto.randomUUID(),
                  threadId,
                  role: "assistant",
                  text: "", // Start with empty text, cache holds the truth for stream
                  createdAt: currentRunState.assistantMessageCreatedAt,
                  model: currentRunState.model,
                  provider: currentRunState.provider,
                })
                .returning();
              currentRunState.currentAssistantMessageId = insertedMessage.id;
              currentRunState.accumulatedResponseText = chunk.textDelta; // First chunk to cache

              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "text-delta",
                messageId: currentRunState.currentAssistantMessageId,
                content: chunk.textDelta,
                role: "assistant",
                createdAt:
                  currentRunState.assistantMessageCreatedAt.toISOString(),
                isInitialChunk: true,
              });
            } else {
              currentRunState.accumulatedResponseText += chunk.textDelta;
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "text-delta",
                messageId: currentRunState.currentAssistantMessageId,
                content: chunk.textDelta,
              });
            }
            // Update cache with the latest accumulated text
            activeStreamCache.set(threadId, currentRunState);
          }
        },
        onError: (error) => {
          console.error(
            `Error running inference for thread ${threadId}:`,
            error
          );
          activeStreamCache.delete(threadId); // Clean up cache on error
        },
        onStepFinish: async ({
          toolCalls,
          toolResults,
          text,
          finishReason,
          reasoning,
        }) => {
          const now = new Date();
          const finalRunState = activeStreamCache.get(threadId);

          if (!finalRunState || !finalRunState.currentAssistantMessageId) {
            console.error(
              `Critical: onStepFinish for thread ${threadId} but no assistant message ID was created or cache lost.`
            );
            // Attempt to create a message if none exists, though it's a degraded state
            if (!finalRunState?.currentAssistantMessageId) {
              const tempMsgId = crypto.randomUUID();
              await db.insert(messages).values({
                userId: userId,
                id: tempMsgId,
                threadId,
                role: "assistant",
                text:
                  text ||
                  (toolCalls && toolCalls.length > 0
                    ? "Calling tools..."
                    : "Processing..."), // Best effort text
                reasoning,
                createdAt: now,
                model,
                provider: modelConfig.provider,
              });
              // No cache to update here as it was missing or didn't have an ID
              eventEmitter.emit(`thread-${threadId}-message`, {
                type:
                  finishReason === "tool-calls"
                    ? "tool-call"
                    : "message-complete",
                message: {
                  id: tempMsgId,
                  text: text,
                  reasoning,
                  toolCalls: toolCalls || [],
                  role: "assistant",
                  createdAt: now.toISOString(),
                },
              });
              if (finishReason !== "tool-calls")
                activeStreamCache.delete(threadId); // Clean cache on completion
              return;
            }
          }

          const currentMsgId = finalRunState.currentAssistantMessageId!;
          const fullAccumulatedText = finalRunState.accumulatedResponseText;

          // Persist the final accumulated text and reasoning from the cache to DB
          await db
            .update(messages)
            .set({
              text: fullAccumulatedText, // Use full text from cache
              reasoning,
            })
            .where(eq(messages.id, currentMsgId));

          if (finishReason === "tool-calls") {
            const persistedToolCalls = [];
            for (const toolCall of toolCalls) {
              /* ... as before ... */
            }
            // Ensure tool calls are persisted to DB, linked to currentMsgId
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
            const assistantMessageWithTools = await db.query.messages.findFirst(
              {
                where: eq(messages.id, currentMsgId),
                with: { toolCalls: true },
              }
            );
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-call",
              message: assistantMessageWithTools,
            });
            // Keep cache for this messageId if LLM might generate more text after tool use
            // The accumulatedResponseText in cache is now the text *before* this tool call.
            // If subsequent text comes, it will append to it.
          } else if (finishReason === "stop" || finishReason === "length") {
            let embedding = null;
            if (fullAccumulatedText && fullAccumulatedText.length > 0) {
              try {
                const embeddingResult = await embeddingModel.doEmbed({
                  values: [fullAccumulatedText],
                });
                embedding = embeddingResult.embeddings[0];
              } catch (error) {
                console.error("Error embedding final message", error);
              }
            }
            await db
              .update(messages)
              .set({ text: fullAccumulatedText, reasoning, embedding })
              .where(eq(messages.id, currentMsgId));

            const finalAssistantMessage = await db.query.messages.findFirst({
              where: eq(messages.id, currentMsgId),
              with: { attachments: true, toolCalls: true },
            });
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "message-complete",
              message: finalAssistantMessage,
            });
            activeStreamCache.delete(threadId); // Clean up cache on completion
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
      activeStreamCache.delete(threadId); // Ensure cache cleanup on any catastrophic error
    } finally {
      // If the stream finished without a "stop" or "length" (e.g. aborted, error not caught by onStepFinish)
      // and there's still an active cache entry, it implies an incomplete generation.
      // Depending on policy, you might clear it or leave it for a short TTL for potential quick reconnects.
      // For now, if not explicitly cleared by stop/length, we'll clear it.
      // However, if it was a tool_call, it should persist.
      const cacheEntry = activeStreamCache.get(threadId);
      if (cacheEntry && cacheEntry.currentAssistantMessageId) {
        // Check if last event was tool_call, if so, don't clear yet
        // This logic needs to be more robust if we want to keep cache after tool_calls
        // For now, assuming errors or aborts lead to cleanup.
      }
      // activeStreamCache.delete(threadId); // Revisit this cleanup based on desired resume behavior post-tool-call
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
            // Potentially include model, provider if needed by client to reconstruct
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
      // Do NOT clear activeStreamCache here, another client might reconnect or stream might still be running.
      // Cache is cleared by runInferenceForThread on completion/error.
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
