// External dependencies
import { and, desc, eq } from "drizzle-orm";
import { streamText } from "ai";
import { v4 as uuidv4 } from "uuid";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import {
  openrouter,
  OpenRouterProviderOptions,
} from "@openrouter/ai-sdk-provider";

// Internal configuration
import db from "../../../config/db";
import s3 from "../../../config/s3";
import { MicrosoftAPI } from "../../../config/microsoft";
import {
  files,
  messages,
  messagesFiles,
  threads,
  toolCalls as toolCallsTable,
  userFiles,
} from "../../../config/schema";

// Internal utilities
import { Workspace } from "../../../middleware";
import { embeddingModel } from "../../models";
import { MyMessage } from "../threads.types";
import {
  abortControllers,
  activeStreamCache,
  ActiveStreamData,
  eventEmitter,
} from "../threads.ops";
import {
  createAndSaveThreadTitle,
  dbMessagesToInferenceMessages,
  getModelConfig,
  loadImagesFromToolResult,
  presignToolResultImages,
} from "../threads.utils";

// LLM Tools
import { ArtifactService } from "../../tools/artifact-service";
import { createSharepointToolSet } from "../../tools/tool-definitions";
import exa from "../../../config/exa";

export const messagesOps = {
  async getMessages(threadId: string) {
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

    // Presign URLs in tool call results for all messages
    for (const msg of processedMessages) {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const toolCall of msg.toolCalls) {
          if (toolCall.result) {
            toolCall.result = await presignToolResultImages(toolCall.result);
          }
        }
      }
    }

    return processedMessages;
  },

  /** Creates a new message in DB with optional embedding and file attachments. */
  async createMessage(
    userId: string,
    threadId: string,
    role: "system" | "user" | "assistant" | "tool",
    message: MyMessage
  ) {
    const messageId = uuidv4();
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
    workspace?: Workspace
  ) {
    // 1) Store the user message
    if (message) {
      await messagesOps.createMessage(userId, threadId, "user", {
        content: message.content || "",
        experimental_attachments: message.experimental_attachments as any,
        role: message.role as any,
      });
    }

    // 2) Start inference asynchronously (don't await)
    setImmediate(async () => {
      try {
        await messagesOps.runInferenceForThread(
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
          messages: {
            with: {
              toolCalls: true,
            },
            orderBy: messages.createdAt,
          },
        },
      });

      if (!thread) {
        console.error(`Thread not found: ${threadId}`);
        cleanup();
        return;
      }

      const allConversationTextContext = thread.messages
        .map((msg) => `Role: ${msg.role}\nContent: ${msg.text}`)
        .join("\n");

      const modelConfig = await getModelConfig(
        model,
        allConversationTextContext
      );

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
      let artifactService: ArtifactService | undefined = undefined;
      if (modelConfig.supportsToolUse) {
        tools = { ...exa.tools };

        // Check if user has Microsoft Graph access and add SharePoint tools
        const microsoftGraph = new MicrosoftAPI({ userId: userId });
        const accessToken = await microsoftGraph.getAccessToken("graph");
        if (accessToken) {
          const sharepointTools = createSharepointToolSet(userId, db);
          tools = { ...tools, ...sharepointTools };
        }

        artifactService = new ArtifactService(threadId, userId);
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

  // Custom logic to decide when to stop iterating
  shouldStopIteration(iteration: number): boolean {
    // Stop if iteration count reaches a threshold
    if (iteration >= 24) return true; // 25 iterations max (0-24)

    return false;
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

      // Create a debug-friendly version that excludes base64 content
      //   const debugMessages = currentMessages.map((msg) => {
      //     if (msg.content && Array.isArray(msg.content)) {
      //       return {
      //         ...msg,
      //         content: msg.content.map((item: any) => {
      //           if (item.type === "image") {
      //             return {
      //               ...item,
      //               image: item.image
      //                 ? "[BASE64_IMAGE_DATA_EXCLUDED]"
      //                 : item.image,
      //             };
      //           }
      //           return item;
      //         }),
      //       };
      //     }
      //     return msg;
      //   });
      //   console.log("currentMessages", debugMessages);

      try {
        // Call streamText without maxSteps - we control the flow manually
        const result = streamText({
          model: openrouter(`anthropic/claude-sonnet-4`),
          messages: currentMessages,
          //   temperature: 0.2,
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
              parallelToolCalls: true,
            } satisfies OpenAIResponsesProviderOptions,
            // anthropic: {
            //   thinking: {
            //     type: iteration === 0 ? "enabled" : "disabled",
            //     budgetTokens: iteration === 0 ? 12_000 : 0,
            //   },
            // } satisfies AnthropicProviderOptions,
            google: {
              thinkingConfig: {
                includeThoughts: true,
                thinkingBudget: 12_000,
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
                id: uuidv4(),
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
          finishReason === "error" ||
          finishReason === "other" ||
          finishReason === "unknown"
        ) {
          console.log(
            `Stopping iteration: hasToolCalls=${hasToolCalls}, finishReason=${finishReason}`
          );
          break;
        }

        // Custom stop condition check
        if (this.shouldStopIteration(iteration)) {
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
          const toolCallDbId = uuidv4();
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

    // Get all messages in the thread ordered by creation time
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, threadId),
      orderBy: [messages.createdAt],
    });

    // Find the index of the message to retry
    const messageToRetryIndex = allMessages.findIndex(
      (msg) => msg.id === messageId
    );

    if (messageToRetryIndex === -1) {
      throw new Error("Message to retry not found in thread");
    }

    // Start collecting messages to delete
    const messagesToDelete: typeof allMessages = [];

    // 1. Add all messages that come after the retry message
    const messagesAfterRetry = allMessages.slice(messageToRetryIndex + 1);
    messagesToDelete.push(...messagesAfterRetry);

    // 2. Add the retry message itself
    messagesToDelete.push(messageToRetry);

    // 3. Go backwards from the retry message and collect all consecutive assistant/tool messages
    // until we hit a user message or reach the beginning
    let currentIndex = messageToRetryIndex - 1;
    while (currentIndex >= 0) {
      const currentMessage = allMessages[currentIndex];

      // If we hit a user message, stop - this is where we want to restart from
      if (currentMessage.role === "user") {
        break;
      }

      // If it's an assistant or tool message, add it to deletion list
      if (
        currentMessage.role === "assistant" ||
        currentMessage.role === "tool"
      ) {
        messagesToDelete.unshift(currentMessage); // Add to beginning to maintain order
        currentIndex--;
      } else {
        // If we hit any other role (like system), stop here
        break;
      }
    }

    // Get the IDs of all messages to delete
    const messageIdsToDelete = messagesToDelete.map((msg) => msg.id);

    // Delete all tool calls for these messages
    for (const msgId of messageIdsToDelete) {
      await db
        .delete(toolCallsTable)
        .where(eq(toolCallsTable.messageId, msgId));
    }

    // Delete message-file relationships for these messages
    for (const msgId of messageIdsToDelete) {
      await db.delete(messagesFiles).where(eq(messagesFiles.messageId, msgId));
    }

    // Delete all the messages
    for (const msgId of messageIdsToDelete) {
      await db.delete(messages).where(eq(messages.id, msgId));
    }

    // Verify that we have a valid state to retry from
    const remainingMessages = await db.query.messages.findMany({
      where: eq(messages.threadId, threadId),
      orderBy: [messages.createdAt],
    });

    if (remainingMessages.length === 0) {
      throw new Error("No messages remain in thread after deletion");
    }

    // The last message should be a user message (or system message)
    const lastMessage = remainingMessages[remainingMessages.length - 1];

    // Start inference asynchronously (don't await)
    setImmediate(async () => {
      try {
        await messagesOps.runInferenceForThread(
          userId,
          threadId,
          model,
          maxTokens,
          instructions,
          workspace
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
      message:
        "Message retry initiated - deleted selected messages and restarting inference",
      deletedMessageIds: messageIdsToDelete,
      deletedMessageCount: messageIdsToDelete.length,
      retryFromMessageId: lastMessage.id,
    };
  },
};
