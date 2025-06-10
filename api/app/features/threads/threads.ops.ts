// External dependencies
import { streamText } from "ai";
import { and, cosineDistance, desc, eq, sql } from "drizzle-orm";
import { Request, Response } from "express";
import { EventEmitter } from "events";
import crypto from "crypto";

// Internal configuration
import db from "../../config/db";
import {
  messages,
  threads,
  toolCalls as toolCallsTable,
  files,
  messagesFiles,
  filePages as filePagesTable,
  userFiles,
} from "../../config/schema";

// Internal features
import { embeddingModel } from "../models";
import { MyMessage } from "./threads.types";
import {
  dbMessagesToInferenceMessages,
  getModelConfig,
  createAndSaveThreadTitle,
  presignToolResultImages,
  loadImagesFromToolResult,
} from "./threads.utils";
import s3 from "../../config/s3";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { MicrosoftAPI } from "../../config/microsoft";
import {
  createSharepointToolSet,
  createWebSearchTool,
} from "../tools/tool-definitions";
import { MARKITDOWN_MIME_TYPES } from "../../config/constants";
import { Workspace } from "../auth/auth.types";
import { ArtifactService } from "../tools/artifact-service";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";

const eventEmitter = new EventEmitter();

// In-memory cache for active streams
interface ActiveStreamData {
  currentAssistantMessageId: string | null;
  accumulatedResponseText: string;
  assistantMessageCreatedAt: Date | null;
  role: "assistant"; // Typically always assistant for this cache
  model?: string;
  provider?: string;
  reasoningStartTime?: Date;
}
const activeStreamCache = new Map<string, ActiveStreamData>();

// In-memory cache for abort controllers
const abortControllers = new Map<string, AbortController>();

const threadsOps = {
  async createThread(
    userId: string,
    organizationId?: string,
    workflowId?: string
  ) {
    if (!userId) throw new Error("User ID is required");
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(threads).values({
      id,
      userId,
      organizationId: organizationId || null,
      workflowId: workflowId || null,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },

  /** Creates a new message in DB with optional embedding and file attachments. */
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

    // Process file attachments if any
    if (message.experimental_attachments?.length) {
      for (const attachment of message.experimental_attachments) {
        try {
          console.log(
            `📂 [ThreadsOps] Linking file to message: ${attachment.file_key}`
          );

          // Find the file by file_key (syyclops_path)
          const existingFile = await db.query.files.findFirst({
            where: eq(files.syyclops_path, attachment.file_key),
          });

          if (existingFile) {
            console.log(
              `✅ [ThreadsOps] File found (ID: ${existingFile.id}), linking to message: ${attachment.file_key}`
            );

            // Link file to message
            await db.insert(messagesFiles).values({
              messageId,
              fileId: existingFile.id,
            });

            // Ensure user-file association exists
            const existingUserFile = await db.query.userFiles.findFirst({
              where: and(
                eq(userFiles.userId, userId),
                eq(userFiles.fileId, existingFile.id)
              ),
            });

            if (!existingUserFile) {
              console.log(
                `🔗 [ThreadsOps] Creating user-file association for user ${userId} and file ${existingFile.id}`
              );
              await db.insert(userFiles).values({
                userId,
                fileId: existingFile.id,
              });
            } else {
              console.log(
                `✅ [ThreadsOps] User-file association already exists`
              );
            }

            // For large documents (PDFs, documents), add to artifact service for this thread
            const isLargeDocument =
              existingFile.mimeType === "application/pdf" ||
              MARKITDOWN_MIME_TYPES.includes(existingFile.mimeType || "");

            if (isLargeDocument) {
              const artifactService = new ArtifactService(threadId);
              const fileName = attachment.name || existingFile.name;
              const existingArtifact =
                await artifactService.loadArtifact(fileName);

              if (!existingArtifact) {
                console.log(
                  `📄 [ThreadsOps] Adding file to artifact service for thread ${threadId}`
                );

                // Get content from existing file pages
                const pages = await db.query.filePages.findMany({
                  where: eq(filePagesTable.fileId, existingFile.id),
                  with: {
                    chunks: {
                      orderBy: (chunks, { asc }) => [asc(chunks.position)],
                    },
                  },
                  orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
                });

                if (pages.length > 0) {
                  const content = pages
                    .map((page) =>
                      page.chunks.map((chunk) => chunk.content).join("\n")
                    )
                    .join("\n\n");

                  await artifactService.saveArtifact(fileName, {
                    data: new TextEncoder().encode(content),
                    mimeType: "text/markdown",
                  });
                }
              } else {
                console.log(
                  `✅ [ThreadsOps] File already exists in artifact service for this thread`
                );
              }
            }

            console.log(
              `🔗 [ThreadsOps] File linked to message: ${attachment.file_key} -> Message ${messageId}`
            );
          } else {
            console.error(
              `❌ [ThreadsOps] File not found in database: ${attachment.file_key}`
            );
            // This shouldn't happen if frontend properly processed the file first
            // But we'll continue processing other attachments
          }
        } catch (error) {
          console.error(
            `❌ [ThreadsOps] Error linking file ${attachment.file_key}:`,
            error
          );
          // Continue processing other attachments
        }
      }
    }

    return { message: "Message created successfully" };
  },

  async getThread(threadId: string) {
    const thread = await db.query.threads.findFirst({
      where: eq(threads.id, threadId),
      with: {
        organization: true,
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
        toolCalls: true,
      },
    });

    // Get file attachments for each message separately since relations aren't set up yet
    const processedMessages = [];
    for (const msg of threadMessages) {
      // Get files for this message
      const messageFiles = await db.query.messagesFiles.findMany({
        where: eq(messagesFiles.messageId, msg.id),
      });

      // Get the actual file records
      const attachments = [];
      for (const msgFile of messageFiles) {
        const file = await db.query.files.findFirst({
          where: eq(files.id, msgFile.fileId),
        });

        if (file) {
          attachments.push({
            id: msgFile.id,
            messageId: msg.id,
            type: file.mimeType?.includes("image") ? "image" : "file",
            fileKey: file.syyclops_path || "",
            fileName: file.name,
            mimeType: file.mimeType,
            size: file.size,
            url: file.syyclops_path
              ? s3.file(file.syyclops_path).presign({ expiresIn: 3600 })
              : undefined,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
          });
        }
      }

      processedMessages.push({
        ...msg,
        attachments,
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

    // Get one extra record to check if there are more pages
    const matchingThreads = await baseQuery.limit(LIMIT + 1).offset(offset);

    // Check if there are more pages
    const hasMore = matchingThreads.length > LIMIT;

    // Remove the extra record if it exists
    const paginatedThreads = hasMore
      ? matchingThreads.slice(0, LIMIT)
      : matchingThreads;

    // If no threads found, return empty result with pagination info
    if (paginatedThreads.length === 0) {
      return {
        threads: [],
        pagination: {
          page,
          pageSize: LIMIT,
          hasMore: false,
          total: 0,
        },
      };
    }

    // Retrieve the full objects while maintaining the original order
    const completeThreads = await db.query.threads.findMany({
      where: (tbl, { and, eq, inArray }) =>
        and(
          eq(tbl.userId, userId),
          organizationId
            ? eq(tbl.organizationId, organizationId)
            : sql`${tbl.organizationId} IS NULL`,
          inArray(
            tbl.id,
            paginatedThreads.map((t) => t.id)
          )
        ),
      with: {
        messages: {
          orderBy: messages.createdAt,
        },
      },
    });

    // Restore the original order from the paginated query
    const orderedThreads = paginatedThreads
      .map((paginatedThread) =>
        completeThreads.find((thread) => thread.id === paginatedThread.id)
      )
      .filter(
        (thread): thread is NonNullable<typeof thread> => thread !== undefined
      );

    // Process attachments for each thread
    const processed = [];
    for (const t of orderedThreads) {
      processed.push(t);
    }

    return {
      threads: processed,
      pagination: {
        page,
        pageSize: LIMIT,
        hasMore,
        total: paginatedThreads.length,
      },
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

  async postMessageAndStartInference(
    userId: string,
    threadId: string,
    message: {
      id?: string | undefined;
      role?: "system" | "user" | "assistant" | "tool" | undefined;
      content?: string | undefined;
      experimental_attachments?:
        | {
            file_key: string;
            name?: string | undefined;
            url?: any;
            contentType?: string | undefined;
          }[]
        | undefined;
    },
    model: string,
    maxTokens?: number,
    instructions?: string,
    workspace?: Workspace,
    thinking?: boolean
  ) {
    // 1) Store the user message
    if (message) {
      console.log("CREATING MESSAGE", message);
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
          workspace,
          thinking
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
    workspace?: Workspace,
    thinking?: boolean
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

    // Helper function to mark current message as failed
    const markCurrentMessageAsFailed = async (error: string) => {
      const currentStreamData = activeStreamCache.get(threadId);
      if (currentStreamData?.currentAssistantMessageId) {
        try {
          await db
            .update(messages)
            .set({
              status: "failed",
              error: error,
              text: currentStreamData.accumulatedResponseText || "",
            })
            .where(
              eq(messages.id, currentStreamData.currentAssistantMessageId)
            );

          // Emit error event for this specific message
          eventEmitter.emit(`thread-${threadId}-message`, {
            type: "message-error",
            messageId: currentStreamData.currentAssistantMessageId,
            error: error,
          });
        } catch (dbError) {
          console.error("Error updating message status to failed:", dbError);
        }
      }
    };

    try {
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
        with: {
          organization: true,
          messages: {
            with: {
              toolCalls: true,
            },
            orderBy: messages.createdAt,
          },
        },
      });
      const modelConfig = getModelConfig(model);

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

      console.log("inferenceMsgs", inferenceMsgs);

      if (!thread.title) {
        createAndSaveThreadTitle(threadId, inferenceMsgs);
      }

      let tools: Record<string, any> | undefined = undefined;
      let artifactService: ArtifactService | undefined = undefined;
      if (modelConfig.supportsToolUse) {
        tools = { web_search: createWebSearchTool() };

        // Check if user has Microsoft Graph access and add SharePoint tools
        const microsoftGraph = new MicrosoftAPI({ userId: userId });
        const accessToken = await microsoftGraph.getAccessToken("graph");
        if (accessToken) {
          const sharepointTools = createSharepointToolSet(userId, db);
          tools = { ...tools, ...sharepointTools };
        }

        artifactService = new ArtifactService(threadId);
        const artifactTools = artifactService.getTools();
        tools = { ...tools, ...artifactTools };
      }

      // Manual tool calling flow
      await this.manualToolCallingFlow(
        modelConfig,
        inferenceMsgs,
        tools,
        maxTokens,
        controller,
        userId,
        threadId,
        model,
        thinking,
        cleanup,
        emitInferenceComplete,
        artifactService,
        markCurrentMessageAsFailed
      );
    } catch (error: any) {
      console.error(
        `Unhandled error in runInferenceForThread for ${threadId}:`,
        error
      );

      const errorMessage =
        error?.message || "An unexpected error occurred during inference";

      // Mark current message as failed if we have one
      await markCurrentMessageAsFailed(errorMessage);

      // Check if this was an abort
      if (error instanceof Error && error.name === "AbortError") {
        console.log(`Inference aborted for thread ${threadId}`);
        // Don't mark aborted messages as failed, they're cancelled
        const currentStreamData = activeStreamCache.get(threadId);
        if (currentStreamData?.currentAssistantMessageId) {
          try {
            await db
              .update(messages)
              .set({
                status: "cancelled",
                text: currentStreamData.accumulatedResponseText || "",
              })
              .where(
                eq(messages.id, currentStreamData.currentAssistantMessageId)
              );

            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "message-cancelled",
              messageId: currentStreamData.currentAssistantMessageId,
            });
          } catch (dbError) {
            console.error(
              "Error updating message status to cancelled:",
              dbError
            );
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

  async manualToolCallingFlow(
    modelConfig: any,
    initialMessages: any[],
    tools: Record<string, any> | undefined,
    maxTokens: number | undefined,
    controller: AbortController,
    userId: string,
    threadId: string,
    model: string,
    thinking: boolean | undefined,
    cleanup: () => void,
    emitInferenceComplete: () => void,
    artifactService?: ArtifactService,
    markCurrentMessageAsFailed?: (error: string) => Promise<void>
  ) {
    let currentMessages = [...initialMessages];
    let iteration = 0;
    const maxIterations = 25; // equivalent to previous maxSteps

    while (iteration < maxIterations) {
      console.log(`=== Manual Tool Calling Iteration ${iteration + 1} ===`);
      console.log(`Current messages count: ${currentMessages.length}`);

      // Check if aborted before starting new iteration
      if (controller.signal.aborted) {
        console.log(`Inference aborted during iteration ${iteration + 1}`);
        break;
      }

      // Track the current step's message state
      let currentStepState: ActiveStreamData = {
        currentAssistantMessageId: null,
        accumulatedResponseText: "",
        assistantMessageCreatedAt: null,
        role: "assistant",
        model: model,
        provider: modelConfig.provider,
      };

      try {
        // Call streamText without maxSteps - we control the flow manually
        const result = streamText({
          model: modelConfig.model,
          messages: currentMessages,
          temperature: 0.45,
          ...(tools && {
            tools: tools,
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
            ...(modelConfig.provider === "anthropic"
              ? (() => {
                  // Only enable thinking for the first iteration to avoid Anthropic API issues
                  // with subsequent assistant messages not having thinking content
                  const enableThinking = iteration === 0 && thinking;

                  if (model.toLowerCase() === "auto" && enableThinking) {
                    return {
                      anthropic: {
                        thinking: { type: "enabled", budgetTokens: 35_000 },
                      } satisfies AnthropicProviderOptions,
                    };
                  }
                  // If it's not auto model, only enable thinking on first iteration
                  else if (model.toLowerCase() !== "auto" && iteration === 0) {
                    return {
                      anthropic: {
                        thinking: { type: "enabled", budgetTokens: 24_000 },
                      } satisfies AnthropicProviderOptions,
                    };
                  }
                  // For subsequent iterations or when thinking is disabled, disable thinking
                  else {
                    return {
                      anthropic: {
                        thinking: { type: "disabled", budgetTokens: 0 },
                      } satisfies AnthropicProviderOptions,
                    };
                  }
                })()
              : {}),
            google: {
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 24_000,
              },
            } satisfies GoogleGenerativeAIProviderOptions,
          },
        });

        // Process the fullStream manually
        const { fullStream } = result;

        let hasToolCalls = false;
        let accumulatedText = "";
        let reasoning = "";
        const toolCalls: any[] = [];
        const toolResults: any[] = [];
        let finishReason: string | undefined;

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
                status: "streaming",
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

        // Process each chunk in the stream
        for await (const chunk of fullStream) {
          // Check for abort signal during streaming
          if (controller.signal.aborted) {
            console.log(`Stream aborted during chunk processing`);
            break;
          }

          switch (chunk.type) {
            case "text-delta":
              // Ensure we have a message for this step
              await ensureAssistantMessage();

              // Accumulate the text delta
              accumulatedText += chunk.textDelta;
              currentStepState.accumulatedResponseText += chunk.textDelta;

              // Emit the delta event
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "text-delta",
                messageId: currentStepState.currentAssistantMessageId,
                content: chunk.textDelta,
              });

              // Update cache with the latest accumulated text
              activeStreamCache.set(threadId, currentStepState);
              break;

            case "reasoning":
              // Ensure we have a message for reasoning content
              await ensureAssistantMessage();

              // Track reasoning start time if this is the first reasoning chunk
              if (!currentStepState.reasoningStartTime) {
                currentStepState.reasoningStartTime = new Date();
                activeStreamCache.set(threadId, currentStepState);
              }

              // Accumulate reasoning text
              reasoning += chunk.textDelta;

              // Handle reasoning chunks (for models that support thinking)
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "reasoning-delta",
                messageId: currentStepState.currentAssistantMessageId,
                content: chunk.textDelta,
              });
              break;

            case "source":
              // Handle source chunks
              if (currentStepState.currentAssistantMessageId) {
                eventEmitter.emit(`thread-${threadId}-message`, {
                  type: "source",
                  messageId: currentStepState.currentAssistantMessageId,
                  source: chunk.source,
                });
              }
              break;

            case "tool-call":
              hasToolCalls = true;
              // For tool calls, we need a message to associate them with
              await ensureAssistantMessage();

              toolCalls.push({
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
              });

              // Simply emit the tool call chunk - no simulation needed since native streaming works
              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call-chunk",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
              });
              break;

            case "tool-call-streaming-start":
              // Handle start of streaming tool call
              await ensureAssistantMessage();

              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call-streaming-start",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
              });
              break;

            case "tool-call-delta":
              // Handle streaming tool call argument deltas (if available)
              await ensureAssistantMessage();

              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-call-delta",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                argsTextDelta: chunk.argsTextDelta,
              });
              break;

            case "tool-result":
              // Handle tool execution results
              await ensureAssistantMessage();

              toolResults.push({
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
                result: chunk.result,
              });

              // Handle images from artifact service tools on the fly
              if (
                (chunk.toolName === "load_file_content" ||
                  chunk.toolName === "search_file_content") &&
                chunk.result &&
                typeof chunk.result === "object" &&
                chunk.result.images &&
                Array.isArray(chunk.result.images) &&
                chunk.result.images.length > 0
              ) {
                console.log(
                  `🖼️ [ThreadsOps] Loading images on-the-fly for ${chunk.toolName} tool result`
                );

                try {
                  // Use shared utility function to load images
                  const validImages = await loadImagesFromToolResult(
                    chunk.result
                  );

                  if (validImages.length > 0) {
                    console.log(
                      `📸 [ThreadsOps] Creating user message with ${validImages.length} images`
                    );

                    // Create user message with images immediately
                    const userMessageWithImages = {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: `Here are the images from the file content that was loaded:`,
                        },
                        ...validImages.map((img) => ({
                          type: "image",
                          image: img.base64Data || img.imageUrl, // Use base64 if available, otherwise URL
                          mimeType: img.mimeType,
                        })),
                      ],
                    };

                    // Add to current messages immediately for next iteration
                    currentMessages.push(userMessageWithImages);
                    console.log(
                      `✅ [ThreadsOps] Added user message with ${validImages.length} images to conversation`
                    );
                  }
                } catch (error) {
                  console.error(
                    `❌ [ThreadsOps] Error processing images for tool result:`,
                    error
                  );
                }
              }

              // Presign image URLs before emitting to client
              const presignedResult = await presignToolResultImages(
                chunk.result
              );

              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "tool-result",
                messageId: currentStepState.currentAssistantMessageId,
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
                result: presignedResult,
              });
              break;

            case "finish":
              finishReason = chunk.finishReason;
              console.log(
                `Finished iteration ${iteration + 1} with reason: ${finishReason}`
              );
              break;

            case "step-start":
              // Handle step start - just log for now
              console.log(`Step started in iteration ${iteration + 1}`);
              break;

            case "step-finish":
              // Handle step finish - this indicates a step completed
              console.log(`Step finished in iteration ${iteration + 1}`);
              break;

            case "reasoning-signature":
              // Handle reasoning signature - part of reasoning process
              if (currentStepState.currentAssistantMessageId) {
                console.log(
                  `Reasoning signature received in iteration ${iteration + 1}`
                );
              }
              break;

            case "error":
              // Handle error chunks
              console.error(
                `Error chunk received in iteration ${iteration + 1}:`,
                chunk.error
              );

              // Mark current message as failed
              const errorMessage =
                chunk.error &&
                typeof chunk.error === "object" &&
                "message" in chunk.error
                  ? (chunk.error as any).message
                  : "An error occurred during AI processing";

              if (markCurrentMessageAsFailed) {
                await markCurrentMessageAsFailed(errorMessage);
              }

              // Set finishReason to stop the iteration
              finishReason = "error";
              break;

            default:
              // Handle any other chunk types
              console.log(`Unhandled chunk type: ${chunk.type}`);
              break;
          }
        }

        // Step finished - handle the completion
        await this.handleStepCompletion(
          currentStepState,
          accumulatedText,
          reasoning,
          toolCalls,
          toolResults,
          threadId,
          userId,
          artifactService,
          finishReason === "error"
        );

        // Add assistant message to current messages for next iteration
        if (accumulatedText.trim() || toolCalls.length > 0) {
          const contentChunks: any[] = [];

          // Add text content if present
          if (accumulatedText.trim()) {
            contentChunks.push({ type: "text", text: accumulatedText.trim() });
          }

          // Add tool calls in AI SDK format (matching createAssistantMessageWithFiles)
          for (const call of toolCalls) {
            contentChunks.push({
              type: "tool-call",
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.args,
            });
          }

          const assistantMessage = {
            role: "assistant",
            content: contentChunks,
          };

          currentMessages.push(assistantMessage);
          console.log(
            `Added assistant message with ${toolCalls.length} tool calls`
          );
        }

        // Add tool result messages in the correct format (matching dbMessagesToInferenceMessages)
        if (toolResults.length > 0) {
          // Create tool results in the same format as createToolMessages in threads.utils.ts
          const processedResults = toolResults.map((result) => ({
            type: "tool-result",
            toolCallId: result.toolCallId,
            toolName: result.toolName,
            result: result.result,
          }));

          // Create tool message with the same structure as dbMessagesToInferenceMessages
          const toolMessage = {
            role: "tool",
            content: processedResults,
          } as any; // Use 'as any' to bypass TypeScript checking like threads.utils.ts does

          currentMessages.push(toolMessage);
          console.log(
            `Added tool result message with ${toolResults.length} results`
          );
        }

        // Check if we should continue iterating
        if (
          !hasToolCalls ||
          finishReason === "stop" ||
          finishReason === "length" ||
          finishReason === "error"
        ) {
          console.log(
            `Stopping iteration: hasToolCalls=${hasToolCalls}, finishReason=${finishReason}`
          );
          break;
        }

        // Custom stop condition check
        if (this.shouldStopIteration(toolResults, iteration)) {
          console.log("Custom stop condition met - stopping iteration");
          break;
        }

        iteration++;
      } catch (stepError: any) {
        console.error(`Error in iteration ${iteration + 1}:`, stepError);

        // Check if this was an abort
        if (stepError instanceof Error && stepError.name === "AbortError") {
          console.log(`Iteration ${iteration + 1} aborted`);
          // Save accumulated text if we have any
          if (
            currentStepState.currentAssistantMessageId &&
            currentStepState.accumulatedResponseText
          ) {
            try {
              await db
                .update(messages)
                .set({
                  text: currentStepState.accumulatedResponseText,
                  status: "cancelled",
                })
                .where(
                  eq(messages.id, currentStepState.currentAssistantMessageId)
                );

              eventEmitter.emit(`thread-${threadId}-message`, {
                type: "message-cancelled",
                messageId: currentStepState.currentAssistantMessageId,
              });
            } catch (err) {
              console.error("Error saving aborted message:", err);
            }
          }
          break;
        }

        // For other errors, mark message as failed and stop the iteration
        const errorMessage =
          stepError?.message || "An unexpected error occurred";
        if (markCurrentMessageAsFailed) {
          await markCurrentMessageAsFailed(errorMessage);
        }
        break;
      }
    }

    console.log(
      `Manual tool calling completed after ${iteration + 1} iterations`
    );

    // Cleanup and emit completion
    cleanup();
    emitInferenceComplete();
  },

  async handleStepCompletion(
    currentStepState: ActiveStreamData,
    text: string,
    reasoning: string,
    toolCalls: any[],
    toolResults: any[],
    threadId: string,
    userId: string,
    artifactService?: ArtifactService,
    hasError: boolean = false
  ) {
    const now = new Date();

    // If we have a current message from this step, finalize it
    if (currentStepState.currentAssistantMessageId) {
      const currentMsgId = currentStepState.currentAssistantMessageId;
      const fullAccumulatedText = currentStepState.accumulatedResponseText;

      // Calculate reasoning duration if we have reasoning start time
      let reasoningDurationSeconds: number | null = null;
      if (currentStepState.reasoningStartTime && reasoning) {
        const reasoningEndTime = new Date();
        reasoningDurationSeconds = Math.round(
          (reasoningEndTime.getTime() -
            currentStepState.reasoningStartTime.getTime()) /
            1000
        );
      }

      // Determine final status - if there was an error, it should already be marked as failed
      // Only update to completed if it's not already failed
      const currentMessage = await db.query.messages.findFirst({
        where: eq(messages.id, currentMsgId),
      });

      const finalStatus =
        currentMessage?.status === "failed" ? "failed" : "completed";

      // Persist the final accumulated text, reasoning, and status to DB
      await db
        .update(messages)
        .set({
          text: fullAccumulatedText,
          reasoning,
          reasoningDurationSeconds,
          status: finalStatus,
        })
        .where(eq(messages.id, currentMsgId));

      // Emit reasoning duration if we have it
      if (reasoningDurationSeconds !== null) {
        eventEmitter.emit(`thread-${threadId}-message`, {
          type: "reasoning-duration",
          messageId: currentMsgId,
          durationSeconds: reasoningDurationSeconds,
        });
      }

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

        const assistantMessageWithTools = await db.query.messages.findFirst({
          where: eq(messages.id, currentMsgId),
          with: { toolCalls: true },
        });

        // Presign URLs in tool call results before emitting
        if (assistantMessageWithTools?.toolCalls) {
          for (const toolCall of assistantMessageWithTools.toolCalls) {
            if (toolCall.result) {
              toolCall.result = await presignToolResultImages(toolCall.result);
            }
          }
        }

        eventEmitter.emit(`thread-${threadId}-message`, {
          type: "tool-call",
          message: assistantMessageWithTools,
        });
      }

      // Handle embeddings for text content (only if not failed)
      if (
        fullAccumulatedText &&
        fullAccumulatedText.length > 0 &&
        finalStatus !== "failed"
      ) {
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
        with: { toolCalls: true },
      });

      // Presign URLs in tool call results before emitting
      if (finalStepMessage?.toolCalls) {
        for (const toolCall of finalStepMessage.toolCalls) {
          if (toolCall.result) {
            toolCall.result = await presignToolResultImages(toolCall.result);
          }
        }
      }

      eventEmitter.emit(`thread-${threadId}-message`, {
        type: "message-complete",
        message: finalStepMessage,
      });
    }
  },

  // Custom logic to decide when to stop iterating
  shouldStopIteration(toolResults: any[], iteration: number): boolean {
    // Stop if iteration count reaches a threshold
    if (iteration >= 24) return true; // 25 iterations max (0-24)

    // Could add custom business logic here:
    // - Stop if we've used a specific tool
    // - Stop if certain conditions are met
    // - Stop based on tool results content

    return false;
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
      with: { toolCalls: true },
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

    // Now handle files and tool calls for each message
    for (let i = 0; i < originalMessages.length; i++) {
      const sourceMsg = originalMessages[i];
      const newMsg = insertedMessages[i];

      // Clone file relationships by querying messagesFiles directly
      const messageFiles = await db.query.messagesFiles.findMany({
        where: eq(messagesFiles.messageId, sourceMsg.id),
      });

      for (const msgFile of messageFiles) {
        await db.insert(messagesFiles).values({
          messageId: newMsg.id,
          fileId: msgFile.fileId,
        });
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

  async retryMessage(
    userId: string,
    threadId: string,
    messageId: string,
    model: string,
    maxTokens?: number,
    instructions?: string,
    workspace?: Workspace,
    thinking?: boolean
  ) {
    // First, verify the message exists and belongs to the user's thread
    const messageToRetry = await db.query.messages.findFirst({
      where: and(eq(messages.id, messageId), eq(messages.threadId, threadId)),
      with: { toolCalls: true },
    });

    if (!messageToRetry) {
      throw new Error("Message not found or access denied");
    }

    // Verify it's an assistant message that can be retried
    if (messageToRetry.role !== "assistant") {
      throw new Error("Only assistant messages can be retried");
    }

    // Delete the failed message and its associated data
    await db
      .delete(toolCallsTable)
      .where(eq(toolCallsTable.messageId, messageId));
    await db
      .delete(messagesFiles)
      .where(eq(messagesFiles.messageId, messageId));
    await db.delete(messages).where(eq(messages.id, messageId));

    // Verify that the last message is now a user message
    const lastMessage = await db.query.messages.findFirst({
      where: eq(messages.threadId, threadId),
      orderBy: [desc(messages.createdAt)],
    });

    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error(
        "Cannot retry: Last message in thread must be a user message"
      );
    }

    // Start inference asynchronously (don't await)
    setImmediate(async () => {
      try {
        await threadsOps.runInferenceForThread(
          userId,
          threadId,
          model,
          maxTokens,
          instructions,
          workspace,
          thinking
        );
      } catch (error) {
        console.error("Error during retry inference:", error);
        // Clean up cache if retry inference setup fails
        activeStreamCache.delete(threadId);
        abortControllers.delete(threadId);
      }
    });

    return {
      success: true,
      message: "Message retry initiated",
      deletedMessageId: messageId,
      lastUserMessageId: lastMessage.id,
    };
  },
};

export default threadsOps;
