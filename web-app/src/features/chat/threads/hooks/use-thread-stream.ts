import { useCallback, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { ChatMessage, MessageRole } from "@/types/chat";
import { chatStatusAtom } from "@/atoms/chat";

interface UseThreadStreamProps {
  threadId?: string;
  viewOnly?: boolean;
  messagesAreBeingFetched?: boolean;
  onMessagesUpdate: (updateFn: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onError: (error: string | null) => void;
}

export function useThreadStream({
  threadId,
  viewOnly,
  messagesAreBeingFetched,
  onMessagesUpdate,
  onError,
}: UseThreadStreamProps) {
  const [, setChatStatus] = useAtom(chatStatusAtom);

  // EventSource ref
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  // Initialize EventSource connection
  const connectToStream = useCallback(() => {
    // Prevent multiple connections
    if (!threadId || eventSourceRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/threads/${threadId}/stream`,
      { withCredentials: true }
    );

    eventSource.onopen = () => {
      console.log("EventSource connection opened for thread:", threadId);
      isConnectingRef.current = false;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // console.log("SSE data received:", data);

        if (data.type === "connected") {
          console.log("Connected to message stream");
        } else if (data.type === "heartbeat") {
          // Keep-alive, do nothing
        } else if (data.type === "stream-resume") {
          onMessagesUpdate((prev) => {
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (existingMessageIndex !== -1) {
              // Update existing message
              return prev.map((msg, index) =>
                index === existingMessageIndex
                  ? {
                      ...msg,
                      text: data.fullText,
                      createdAt: data.createdAt || msg.createdAt,
                      role: data.role || msg.role,
                    }
                  : msg
              );
            } else {
              // Add as a new message if it doesn't exist (edge case)
              const newMessage: ChatMessage = {
                id: data.messageId,
                role: data.role as MessageRole,
                text: data.fullText,
                createdAt: data.createdAt || new Date().toISOString(),
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            }
          });
          //   setChatStatus("streaming");
        } else if (data.type === "text-delta") {
          setChatStatus("streaming");
          onMessagesUpdate((prev) => {
            const targetMessageId = data.messageId;
            const isInitialChunk = data.isInitialChunk;

            // Try to find the message by ID
            let messageExists = prev.some((msg) => msg.id === targetMessageId);

            if (targetMessageId && messageExists) {
              return prev.map((msg) =>
                msg.id === targetMessageId
                  ? {
                      ...msg,
                      text: (msg.text || "") + data.content,
                    }
                  : msg
              );
            } else if (targetMessageId && isInitialChunk) {
              // Create a new assistant message for streaming if it's an initial chunk and ID provided
              const newMessage: ChatMessage = {
                id: targetMessageId,
                role: (data.role as MessageRole) || MessageRole.assistant,
                text: data.content,
                createdAt: data.createdAt || new Date().toISOString(),
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            } else if (!targetMessageId && prev.length > 0) {
              // Fallback: If no messageId, append to the last assistant message if it's streaming
              const lastMessage = prev[prev.length - 1];
              if (
                lastMessage &&
                lastMessage.role === MessageRole.assistant &&
                lastMessage.text !== null
              ) {
                return prev.map((msg, index) =>
                  index === prev.length - 1
                    ? {
                        ...msg,
                        text: (msg.text || "") + data.content,
                      }
                    : msg
                );
              } else {
                // Fallback: Create a new assistant message if last one isn't suitable
                const newMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: MessageRole.assistant,
                  text: data.content,
                  createdAt: new Date().toISOString(),
                  attachments: [],
                  toolCalls: [],
                };
                return [...prev, newMessage];
              }
            } else {
              // Fallback: if no targetMessageId and no previous messages, create a new one.
              const newMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: MessageRole.assistant,
                text: data.content,
                createdAt: new Date().toISOString(),
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            }
          });
        } else if (data.type === "message-complete") {
          onMessagesUpdate((prev) => {
            // Replace the message with the complete one from the server
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.message.id
            );
            if (existingMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === existingMessageIndex ? data.message : msg
              );
            } else {
              // If message doesn't exist, add it (should be rare if streaming was handled)
              return [...prev, data.message];
            }
          });
          // Don't set status to "ready" here - the AI might continue with more steps
          // Status will be set to "ready" when the entire inference run completes
        } else if (data.type === "tool-call") {
          setChatStatus("streaming");
          // The `data.message` here IS the assistant message that contains the tool calls
          onMessagesUpdate((prev) => {
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.message.id
            );
            if (existingMessageIndex !== -1) {
              // Replace the existing message with the one from the event, which includes tool_calls
              return prev.map((msg, index) =>
                index === existingMessageIndex
                  ? {
                      ...data.message,
                    }
                  : msg
              );
            } else {
              // If for some reason this assistant message isn't in state, add it.
              return [
                ...prev,
                {
                  ...data.message,
                },
              ];
            }
          });
        } else if (data.type === "inference-complete") {
          // New event type to indicate the entire inference run is complete
          setChatStatus("ready");
        } else if (data.type === "reasoning-delta") {
          setChatStatus("streaming");
          // Handle reasoning text deltas (for models that support thinking)
          onMessagesUpdate((prev) => {
            const targetMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (targetMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === targetMessageIndex
                  ? {
                      ...msg,
                      reasoning: (msg.reasoning || "") + data.content,
                    }
                  : msg
              );
            } else {
              // Create a new message if it doesn't exist (happens when reasoning comes first in a new step)
              const newMessage: ChatMessage = {
                id: data.messageId,
                role: MessageRole.assistant,
                text: "", // Start with empty text, will be filled by subsequent text-delta events
                reasoning: data.content,
                createdAt: new Date().toISOString(),
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            }
          });
        } else if (data.type === "source") {
          // Handle source information - for now just log it since ChatMessage doesn't have sources
          console.log("Source data received:", data.source);
        } else if (data.type === "tool-call-chunk") {
          // Handle complete tool call chunks
          onMessagesUpdate((prev) => {
            const targetMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (targetMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === targetMessageIndex
                  ? {
                      ...msg,
                      toolCalls: (() => {
                        const existingToolCalls = msg.toolCalls || [];
                        const existingToolCallIndex =
                          existingToolCalls.findIndex(
                            (tc) => tc.toolCallId === data.toolCallId
                          );

                        if (existingToolCallIndex !== -1) {
                          // Update existing tool call
                          return existingToolCalls.map((tc, tcIndex) =>
                            tcIndex === existingToolCallIndex
                              ? {
                                  ...tc,
                                  toolName: data.toolName,
                                  args: data.args,
                                  status: "pending" as const,
                                }
                              : tc
                          );
                        } else {
                          // Add new tool call
                          return [
                            ...existingToolCalls,
                            {
                              id: crypto.randomUUID(),
                              messageId: data.messageId,
                              toolCallId: data.toolCallId,
                              toolName: data.toolName,
                              args: data.args,
                              status: "pending" as const,
                              createdAt: new Date().toISOString(),
                            },
                          ];
                        }
                      })(),
                    }
                  : msg
              );
            }
            return prev;
          });
        } else if (data.type === "tool-call-streaming-start") {
          setChatStatus("streaming");
          // Handle start of streaming tool call
          onMessagesUpdate((prev) => {
            const targetMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (targetMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === targetMessageIndex
                  ? {
                      ...msg,
                      toolCalls: (() => {
                        const existingToolCalls = msg.toolCalls || [];
                        const existingToolCallIndex =
                          existingToolCalls.findIndex(
                            (tc) => tc.toolCallId === data.toolCallId
                          );

                        if (existingToolCallIndex !== -1) {
                          // Update existing tool call to streaming status
                          return existingToolCalls.map((tc, tcIndex) =>
                            tcIndex === existingToolCallIndex
                              ? {
                                  ...tc,
                                  toolName: data.toolName,
                                  args: {},
                                  status: "streaming" as const,
                                }
                              : tc
                          );
                        } else {
                          // Add new streaming tool call
                          return [
                            ...existingToolCalls,
                            {
                              id: crypto.randomUUID(),
                              messageId: data.messageId,
                              toolCallId: data.toolCallId,
                              toolName: data.toolName,
                              args: {},
                              status: "streaming" as const,
                              createdAt: new Date().toISOString(),
                            },
                          ];
                        }
                      })(),
                    }
                  : msg
              );
            }
            return prev;
          });
        } else if (data.type === "tool-call-delta") {
          // Handle streaming tool call argument deltas
          //   console.log("Tool call delta received:", data);
        } else if (data.type === "tool-result") {
          // Handle tool execution results
          onMessagesUpdate((prev) => {
            const targetMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (targetMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === targetMessageIndex
                  ? {
                      ...msg,
                      toolCalls: (msg.toolCalls || []).map((toolCall) =>
                        toolCall.toolCallId === data.toolCallId
                          ? {
                              ...toolCall,
                              args: data.args,
                              result: data.result,
                              status: "completed" as const,
                            }
                          : toolCall
                      ),
                    }
                  : msg
              );
            }
            return prev;
          });
        } else if (data.type === "message-error") {
          console.error("Message error event from server:", data.error);
          toast.error(data.error || "Error processing message on server.");
          onMessagesUpdate((prev) => {
            if (data.message && data.message.id) {
              const existingMessageIndex = prev.findIndex(
                (msg) => msg.id === data.message.id
              );
              if (existingMessageIndex !== -1) {
                return prev.map((msg, index) =>
                  index === existingMessageIndex
                    ? {
                        ...data.message,
                        text:
                          data.message.text +
                          `\n[SERVER ERROR: ${data.error || "Unknown"}]`,
                      }
                    : msg
                );
              } else {
                return [
                  ...prev,
                  {
                    ...data.message,
                    text:
                      data.message.text +
                      `\n[SERVER ERROR: ${data.error || "Unknown"}]`,
                  },
                ];
              }
            }
            return prev;
          });
          setChatStatus("ready");
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      onError("Connection to message stream lost. Please refresh.");
      setChatStatus("ready");
      isConnectingRef.current = false;
    };

    eventSourceRef.current = eventSource;
  }, [threadId, setChatStatus, onMessagesUpdate, onError]);

  // Disconnect from EventSource
  const disconnectFromStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("Disconnected from message stream for thread:", threadId);
    }
    isConnectingRef.current = false;
  }, [threadId]);

  // Initialize EventSource on mount and when threadId changes
  useEffect(() => {
    if (messagesAreBeingFetched) {
      disconnectFromStream();
      return;
    }

    // Simply connect if we have a threadId and we're not in view-only mode
    if (threadId && !viewOnly) {
      connectToStream();
    }

    return () => {
      disconnectFromStream();
    };
  }, [
    threadId,
    viewOnly,
    messagesAreBeingFetched,
    connectToStream,
    disconnectFromStream,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectFromStream();
    };
  }, [disconnectFromStream]);

  return {
    connectToStream,
    disconnectFromStream,
  };
}
