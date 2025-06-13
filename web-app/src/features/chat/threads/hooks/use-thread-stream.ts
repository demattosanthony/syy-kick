import { useCallback, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { ChatMessage, MessageRole } from "@/types/chat";
import { chatStatusAtom } from "@/atoms/chat";

interface UseThreadStreamProps {
  threadId?: string;
  viewOnly?: boolean;
  messagesAreBeingFetched?: boolean;
  onMessagesUpdate: (updateFn: (prev: ChatMessage[]) => ChatMessage[]) => void;
  onError: (error: string | null) => void;
}

interface EventHandlers {
  setChatStatus: (
    status: "ready" | "submitted" | "streaming" | "error"
  ) => void;
  onMessagesUpdate: (updateFn: (prev: ChatMessage[]) => ChatMessage[]) => void;
}

// Helper functions
const findMessageIndex = (messages: ChatMessage[], messageId: string) =>
  messages.findIndex((msg) => msg.id === messageId);

const createMessage = (
  id: string,
  role: MessageRole = MessageRole.assistant,
  text = "",
  createdAt = new Date().toISOString(),
  reasoning?: string
): ChatMessage => ({
  id,
  threadId: "", // Default empty string - this gets updated properly by the backend data
  userId: "", // Default empty string - this gets updated properly by the backend data
  role,
  text,
  reasoning,
  createdAt,
  attachments: [],
  toolCalls: [],
});

const updateMessageField = (
  message: ChatMessage,
  field: string,
  value: string
): ChatMessage => ({
  ...message,
  [field]: (message[field as keyof ChatMessage] || "") + value,
});

const updateMessageAtIndex = (
  messages: ChatMessage[],
  index: number,
  updater: (msg: ChatMessage) => ChatMessage
) => messages.map((msg, i) => (i === index ? updater(msg) : msg));

const addOrUpdateMessage = (
  messages: ChatMessage[],
  messageId: string,
  updater: (msg: ChatMessage) => ChatMessage,
  creator: () => ChatMessage
) => {
  const index = findMessageIndex(messages, messageId);
  return index !== -1
    ? updateMessageAtIndex(messages, index, updater)
    : [...messages, creator()];
};

const updateOrCreateToolCall = (
  toolCalls: any[],
  toolCallId: string,
  data: any,
  isArgsTextDelta: boolean = false
) => {
  const index = toolCalls.findIndex((tc) => tc.toolCallId === toolCallId);

  if (index !== -1) {
    return toolCalls.map((tc, i) => {
      if (i === index) {
        if (isArgsTextDelta) {
          // For streaming args, accumulate the argsTextDelta fragments
          const currentArgsText = tc.argsText || "";
          const newArgsText = currentArgsText + (data.argsTextDelta || "");

          // Try to parse the accumulated args text as JSON
          let parsedArgs = tc.args || {};
          try {
            parsedArgs = JSON.parse(newArgsText);
          } catch (error) {
            // If it's not valid JSON yet, keep the previous args
            parsedArgs = tc.args || {};
          }

          const updatedToolCall = {
            ...tc,
            argsText: newArgsText,
            args: parsedArgs,
            status: "streaming" as const,
            state: "call" as const,
          };
          return updatedToolCall;
        } else {
          return { ...tc, ...data };
        }
      }
      return tc;
    });
  } else {
    // Creating a new tool call entry
    let initialArgs = data.args || {};
    let initialArgsText = "";

    if (isArgsTextDelta && data.argsTextDelta) {
      // Start with the first fragment
      initialArgsText = data.argsTextDelta;
      try {
        initialArgs = JSON.parse(initialArgsText);
      } catch {
        // If first fragment isn't valid JSON, keep empty args
        initialArgs = {};
      }
    } else if (data.args) {
      try {
        initialArgsText = JSON.stringify(data.args);
      } catch {
        initialArgsText = "";
      }
    }

    const toolCall = {
      id: crypto.randomUUID(),
      toolCallId,
      createdAt: new Date().toISOString(),
      argsText: initialArgsText,
      args: initialArgs,
      ...data,
    };

    // Clean up to avoid duplicate data
    delete toolCall.argsTextDelta;
    if (isArgsTextDelta) {
      delete toolCall.args; // Will be set correctly above
    }

    return [...toolCalls, toolCall];
  }
};

// Simplified event handlers
const handleStreamResume = (data: any, { onMessagesUpdate }: EventHandlers) => {
  onMessagesUpdate((prev) =>
    addOrUpdateMessage(
      prev,
      data.messageId,
      (msg) => ({
        ...msg,
        text: data.fullText,
        createdAt: data.createdAt || msg.createdAt,
        role: data.role || msg.role,
      }),
      () =>
        createMessage(data.messageId, data.role, data.fullText, data.createdAt)
    )
  );
};

const handleTextDelta = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  setChatStatus("streaming");
  onMessagesUpdate((prev) => {
    const { messageId, content, isInitialChunk, role, createdAt } = data;

    if (messageId && prev.some((msg) => msg.id === messageId)) {
      return prev.map((msg) =>
        msg.id === messageId ? updateMessageField(msg, "text", content) : msg
      );
    }

    if (messageId && isInitialChunk) {
      return [
        ...prev,
        createMessage(
          messageId,
          role || MessageRole.assistant,
          content,
          createdAt
        ),
      ];
    }

    // Fallback logic for messages without ID
    if (prev.length > 0) {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === MessageRole.assistant && lastMsg.text !== null) {
        return updateMessageAtIndex(prev, prev.length - 1, (msg) =>
          updateMessageField(msg, "text", content)
        );
      }
    }

    return [
      ...prev,
      createMessage(crypto.randomUUID(), MessageRole.assistant, content),
    ];
  });
};

const handleMessageComplete = (
  data: any,
  { onMessagesUpdate }: EventHandlers
) => {
  onMessagesUpdate((prev) =>
    addOrUpdateMessage(
      prev,
      data.message.id,
      () => data.message,
      () => data.message
    )
  );
};

const handleToolCall = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  setChatStatus("streaming");
  onMessagesUpdate((prev) =>
    addOrUpdateMessage(
      prev,
      data.message.id,
      () => ({ ...data.message }),
      () => ({ ...data.message })
    )
  );
};

const handleReasoningDelta = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  setChatStatus("streaming");
  onMessagesUpdate((prev) =>
    addOrUpdateMessage(
      prev,
      data.messageId,
      (msg) => updateMessageField(msg, "reasoning", data.content),
      () =>
        createMessage(
          data.messageId,
          MessageRole.assistant,
          "",
          undefined,
          data.content
        )
    )
  );
};

const handleToolCallChunk = (
  data: any,
  { onMessagesUpdate }: EventHandlers
) => {
  onMessagesUpdate((prev) => {
    const index = findMessageIndex(prev, data.messageId);
    return index !== -1
      ? updateMessageAtIndex(prev, index, (msg) => ({
          ...msg,
          toolCalls: updateOrCreateToolCall(
            msg.toolCalls || [],
            data.toolCallId,
            {
              messageId: data.messageId,
              toolName: data.toolName,
              args: data.args,
              status:
                data.toolName === "create_artifact" ? "streaming" : "pending",
              state: "call" as const,
            },
            false // isArgsTextDelta = false
          ),
        }))
      : prev;
  });
};

const handleToolCallStreamingStart = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  setChatStatus("streaming");
  onMessagesUpdate((prev) => {
    const messageIndex = findMessageIndex(prev, data.messageId);
    if (messageIndex === -1) {
      return prev;
    }

    return updateMessageAtIndex(prev, messageIndex, (msg) => {
      const updatedToolCalls = updateOrCreateToolCall(
        msg.toolCalls || [],
        data.toolCallId,
        {
          messageId: data.messageId,
          toolName: data.toolName,
          args: {}, // Initialize with empty parsed args
          argsText: "", // Initialize with EMPTY STRING for raw fragment accumulation
          status: "streaming" as const,
          state: "call" as const,
        },
        false // This is not a delta itself, it's setting up for deltas
      );
      return { ...msg, toolCalls: updatedToolCalls };
    });
  });
};

const handleToolResult = (data: any, { onMessagesUpdate }: EventHandlers) => {
  onMessagesUpdate((prev) => {
    const index = findMessageIndex(prev, data.messageId);
    return index !== -1
      ? updateMessageAtIndex(prev, index, (msg) => ({
          ...msg,
          toolCalls: (msg.toolCalls || []).map((tc) =>
            tc.toolCallId === data.toolCallId
              ? {
                  ...tc,
                  args: data.args,
                  result: data.result,
                  status: "completed" as const,
                  state: "result" as const,
                }
              : tc
          ),
        }))
      : prev;
  });
};

const handleMessageError = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  console.error("Message error event from server:", data.error);

  // Update the specific message to show failed status and error
  if (data.messageId) {
    onMessagesUpdate((prev) =>
      addOrUpdateMessage(
        prev,
        data.messageId,
        (msg) => ({
          ...msg,
          status: "failed",
          error: data.error,
        }),
        () =>
          createMessage(
            data.messageId,
            MessageRole.assistant,
            "",
            undefined,
            undefined
          )
      )
    );
  }
  setChatStatus("ready");
};

const handleMessageCancelled = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  console.log("Message cancelled event from server:", data.messageId);

  // Update the specific message to show cancelled status
  if (data.messageId) {
    onMessagesUpdate((prev) =>
      addOrUpdateMessage(
        prev,
        data.messageId,
        (msg) => ({
          ...msg,
          status: "cancelled",
        }),
        () =>
          createMessage(
            data.messageId,
            MessageRole.assistant,
            "",
            undefined,
            undefined
          )
      )
    );
  }
  setChatStatus("ready");
};

const handleReasoningDuration = (
  data: any,
  { onMessagesUpdate }: EventHandlers
) => {
  onMessagesUpdate((prev) =>
    addOrUpdateMessage(
      prev,
      data.messageId,
      (msg) => ({ ...msg, reasoningDurationSeconds: data.durationSeconds }),
      () =>
        createMessage(
          data.messageId,
          MessageRole.assistant,
          "",
          undefined,
          undefined
        )
    )
  );
};

const handleToolCallDelta = (
  data: any,
  { setChatStatus, onMessagesUpdate }: EventHandlers
) => {
  setChatStatus("streaming");
  onMessagesUpdate((prev) => {
    const index = findMessageIndex(prev, data.messageId);
    if (index !== -1) {
      const updatedMessages = updateMessageAtIndex(prev, index, (msg) => {
        const updatedToolCalls = updateOrCreateToolCall(
          msg.toolCalls || [],
          data.toolCallId,
          {
            messageId: data.messageId,
            toolName: data.toolName,
            argsTextDelta: data.argsTextDelta,
          },
          true // isArgsTextDelta = true
        );
        return {
          ...msg,
          toolCalls: updatedToolCalls,
        };
      });
      return updatedMessages;
    }
    return prev;
  });
};

// Event dispatcher with lookup table
const eventHandlers = {
  "stream-resume": handleStreamResume,
  "text-delta": handleTextDelta,
  "message-complete": handleMessageComplete,
  "tool-call": handleToolCall,
  "reasoning-delta": handleReasoningDelta,
  "reasoning-duration": handleReasoningDuration,
  "tool-call-chunk": handleToolCallChunk,
  "tool-call-streaming-start": handleToolCallStreamingStart,
  "tool-call-delta": handleToolCallDelta,
  "tool-result": handleToolResult,
  "message-error": handleMessageError,
  "message-cancelled": handleMessageCancelled,
  "inference-complete": (_data: any, { setChatStatus }: EventHandlers) =>
    setChatStatus("ready"),
  "inference-stopped": (_data: any, { setChatStatus }: EventHandlers) =>
    setChatStatus("ready"),
  connected: () => {},
  source: () => {},
  heartbeat: () => {}, // Keep-alive
};

const handleEventMessage = (event: MessageEvent, handlers: EventHandlers) => {
  try {
    const data = JSON.parse(event.data);
    const handler = eventHandlers[data.type as keyof typeof eventHandlers];

    if (handler) {
      handler(data, handlers);
    } else {
      console.warn("Unknown event type:", data.type);
    }
  } catch (error) {
    console.error("Error parsing SSE data:", error);
  }
};

export function useThreadStream({
  threadId,
  viewOnly,
  messagesAreBeingFetched,
  onMessagesUpdate,
  onError,
}: UseThreadStreamProps) {
  const [, setChatStatus] = useAtom(chatStatusAtom);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  const connectToStream = useCallback(() => {
    if (!threadId || eventSourceRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/threads/${threadId}/stream`,
      { withCredentials: true }
    );

    const handlers: EventHandlers = { setChatStatus, onMessagesUpdate };

    eventSource.onopen = () => {
      //   console.log("EventSource connection opened for thread:", threadId);
      isConnectingRef.current = false;
    };

    eventSource.onmessage = (event) => handleEventMessage(event, handlers);

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      onError("Connection to message stream lost. Please refresh.");
      setChatStatus("ready");
      isConnectingRef.current = false;
    };

    eventSourceRef.current = eventSource;
  }, [threadId, setChatStatus, onMessagesUpdate, onError]);

  const disconnectFromStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      //   console.log("Disconnected from message stream for thread:", threadId);
    }
    isConnectingRef.current = false;
  }, [threadId]);

  useEffect(() => {
    if (messagesAreBeingFetched) {
      disconnectFromStream();
      return;
    }

    if (threadId && !viewOnly) {
      connectToStream();
    }

    return disconnectFromStream;
  }, [
    threadId,
    viewOnly,
    messagesAreBeingFetched,
    connectToStream,
    disconnectFromStream,
  ]);

  useEffect(() => disconnectFromStream, [disconnectFromStream]);

  return { connectToStream, disconnectFromStream };
}
