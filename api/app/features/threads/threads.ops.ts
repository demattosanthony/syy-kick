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
  filePageChunks,
  filePageImages,
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
import { processFile } from "../../doc-processor-v2";
import s3 from "../../config/s3";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import { MicrosoftAPI } from "../../config/microsoft";
import { createSharepointToolSet } from "../tools/tool-definitions";
import { MARKITDOWN_MIME_TYPES } from "../../config/constants";
import { Workspace } from "../auth/auth.types";
import { ArtifactService } from "../workflows/artifact-service";
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
      const artifactService = new ArtifactService(threadId);

      for (const attachment of message.experimental_attachments) {
        try {
          console.log(
            `📂 [ThreadsOps] Processing attachment: ${attachment.file_key}`
          );

          // Download the file from S3
          console.log(
            `⬇️ [ThreadsOps] Downloading file from S3: ${attachment.file_key}`
          );

          // Check if file exists first
          try {
            const fileExists = await s3.file(attachment.file_key).exists();
            if (!fileExists) {
              throw new Error(
                `File does not exist in S3: ${attachment.file_key}`
              );
            }
            console.log(
              `✓ [ThreadsOps] File exists in S3: ${attachment.file_key}`
            );
          } catch (existsError) {
            console.error(
              `❌ [ThreadsOps] Error checking if file exists: ${existsError}`
            );
            throw new Error(
              `Failed to verify file existence in S3: ${attachment.file_key}`
            );
          }

          const attachmentBuffer = await s3
            .file(attachment.file_key)
            .arrayBuffer();

          console.log(
            `📊 [ThreadsOps] Downloaded buffer size: ${attachmentBuffer.byteLength} bytes`
          );

          if (attachmentBuffer.byteLength === 0) {
            throw new Error(
              `Downloaded file is empty (0 bytes): ${attachment.file_key}`
            );
          }

          const buffer = Buffer.from(attachmentBuffer);
          console.log(
            `✅ [ThreadsOps] Buffer created successfully: ${buffer.length} bytes`
          );

          // Calculate file hash for deduplication
          const fileHash = crypto
            .createHash("sha256")
            .update(buffer)
            .digest("hex");
          console.log(`🔑 [ThreadsOps] File hash: ${fileHash}`);

          // Determine the file path for storage
          const fileName =
            attachment.name ||
            attachment.file_key.split("/").pop() ||
            "unknown";
          const mimeType = attachment.contentType || "application/octet-stream";

          // Check if file with same hash already exists
          const existingFile = await db.query.files.findFirst({
            where: eq(files.fileHash, fileHash),
          });

          let fileToLink;

          if (existingFile) {
            console.log(
              `♻️ [ThreadsOps] File already exists (ID: ${existingFile.id}), reusing existing file`
            );
            fileToLink = existingFile;

            // Check if we need to add to artifact service for this thread
            const isLargeDocument =
              mimeType === "application/pdf" ||
              MARKITDOWN_MIME_TYPES.includes(mimeType);

            if (isLargeDocument) {
              // Check if already exists in artifact service for this thread
              const existingArtifact =
                await artifactService.loadArtifact(fileName);

              if (!existingArtifact) {
                console.log(
                  `📄 [ThreadsOps] Adding existing file to artifact service for thread ${threadId}`
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
          } else {
            console.log(
              `🆕 [ThreadsOps] New file detected, storing and processing`
            );

            // Insert new file into files table
            const [insertedFile] = await db
              .insert(files)
              .values({
                name: fileName,
                mimeType,
                size: buffer.length,
                type: "file",
                fileHash: fileHash,
                syyclops_path: attachment.file_key,
                file_origin_type: "syyclops",
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            fileToLink = insertedFile;

            // Process file with document pipeline
            try {
              console.log(
                `⚙️ [ThreadsOps] Processing file content for: ${fileName}`
              );
              const processedFilePages = await processFile(
                buffer,
                fileName,
                mimeType
              );

              // Store processed file pages in database
              for (const pageData of processedFilePages) {
                const [insertedPage] = await db
                  .insert(filePagesTable)
                  .values({
                    fileId: insertedFile.id,
                    pageNumber: pageData.pageNumber,
                  })
                  .returning();

                // Store chunks for this page
                if (pageData.chunks && pageData.chunks.length > 0) {
                  const chunkValues = pageData.chunks.map((chunk) => ({
                    filePageId: insertedPage.id,
                    content: chunk.content,
                    position: chunk.position,
                  }));
                  await db.insert(filePageChunks).values(chunkValues);
                }

                // Store images for this page
                if (pageData.images && pageData.images.length > 0) {
                  const imageValues = pageData.images.map((image) => ({
                    filePageId: insertedPage.id,
                    name: image.name,
                    imagePath: image.path,
                  }));
                  await db.insert(filePageImages).values(imageValues);
                }
              }

              console.log(
                `✅ [ThreadsOps] File processing completed: ${processedFilePages.length} pages processed`
              );

              // For large documents (PDFs, documents), add to artifact service
              const isLargeDocument =
                mimeType === "application/pdf" ||
                MARKITDOWN_MIME_TYPES.includes(mimeType);

              if (isLargeDocument && processedFilePages.length > 0) {
                console.log(
                  `📄 [ThreadsOps] Adding large document to artifact service: ${fileName}`
                );

                // Add to artifact service for agent access
                const content = processedFilePages
                  .map((page) =>
                    page.chunks.map((chunk) => chunk.content).join("\n")
                  )
                  .join("\n\n");

                await artifactService.saveArtifact(fileName, {
                  data: new TextEncoder().encode(content),
                  mimeType: "text/markdown",
                });
              }
            } catch (processingError) {
              console.error(
                `❌ [ThreadsOps] Error processing file ${fileName}:`,
                processingError
              );
              // Continue even if processing fails - the file is still stored
            }
          }

          // Link file to message (always create this relationship)
          await db.insert(messagesFiles).values({
            messageId,
            fileId: fileToLink.id,
          });

          console.log(
            `🔗 [ThreadsOps] File linked to message: ${fileName} -> Message ${messageId}`
          );
        } catch (error) {
          console.error(
            `❌ [ThreadsOps] Error handling attachment ${attachment.file_key}:`,
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
          messages: {
            with: {
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

      console.log("inferenceMsgs", inferenceMsgs);

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

        const artifactService = new ArtifactService(threadId);
        const artifactTools = artifactService.getTools();
        tools = { ...tools, ...artifactTools };
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
          ...(modelConfig.provider === "anthropic"
            ? (() => {
                // If model is "Auto" and thinking is true, enable thinking with budget 35_000
                if (model.toLowerCase() === "auto" && thinking) {
                  return {
                    anthropic: {
                      thinking: { type: "enabled", budgetTokens: 35_000 },
                    } satisfies AnthropicProviderOptions,
                  };
                }
                // If it's not auto model, thinking is always false, but still set thinking enabled
                else if (model.toLowerCase() !== "auto") {
                  return {
                    anthropic: {
                      thinking: { type: "enabled", budgetTokens: 24_000 },
                    } satisfies AnthropicProviderOptions,
                  };
                }
                // For auto model with thinking false, disable thinking
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
        onChunk: async ({ chunk }) => {
          //   console.log("onChunk", chunk);
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

            // Track reasoning start time if this is the first reasoning chunk
            if (!currentStepState.reasoningStartTime) {
              currentStepState.reasoningStartTime = new Date();
              activeStreamCache.set(threadId, currentStepState);
            }

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

            // Simply emit the tool call chunk - no simulation needed since native streaming works
            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-call-chunk",
              messageId: currentStepState.currentAssistantMessageId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: chunk.args,
            });
          } else if (chunk.type === "tool-call-streaming-start") {
            // Handle start of streaming tool call
            await ensureAssistantMessage();

            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-call-streaming-start",
              messageId: currentStepState.currentAssistantMessageId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
            });
          } else if (chunk.type === "tool-call-delta") {
            // Handle streaming tool call argument deltas (if available)
            await ensureAssistantMessage();

            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-call-delta",
              messageId: currentStepState.currentAssistantMessageId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              argsTextDelta: chunk.argsTextDelta,
            });
          } else if (chunk.type === "tool-result") {
            // Handle tool execution results
            await ensureAssistantMessage();

            eventEmitter.emit(`thread-${threadId}-message`, {
              type: "tool-result",
              messageId: currentStepState.currentAssistantMessageId,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: chunk.args,
              result: chunk.result,
            });
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

            // Persist the final accumulated text and reasoning to DB
            await db
              .update(messages)
              .set({
                text: fullAccumulatedText,
                reasoning,
                reasoningDurationSeconds,
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
              with: { toolCalls: true },
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
              reasoningStartTime: undefined,
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
};

export default threadsOps;
