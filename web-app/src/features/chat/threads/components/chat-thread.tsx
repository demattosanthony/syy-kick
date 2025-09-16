// Types
import { ChatMessage } from "@/types/chat";

// Components
import { Thread } from "@/types/chat";
import ThreadHeader from "./thread-header";
import {
  ArtifactViewer,
  ChatInputForm,
  ChatMessagesList,
} from "@/features/chat/messages/components";
import { CloneThreadButton } from "./clone-thread-button";

// Hooks
import { useCallback } from "react";
import {
  useResizeLayout,
  useThreadStream,
  useMessageSubmission,
} from "../hooks";
import { useChatState } from "../hooks/use-chat-state";
import { useAtom } from "jotai";
import { instructionsAtom, modelAtom, pendingThreadAtom } from "@/atoms/chat";

// Utils
import { convertChatMessagesToMessages } from "../utils/message-conversion";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ThreadPage({
  initalMessages,
  thread,
  viewOnly = false,
  messagesAreBeingFetched = false,
  showCloneThreadButton = false,
}: {
  initalMessages: ChatMessage[];
  thread?: Thread;
  viewOnly?: boolean;
  messagesAreBeingFetched?: boolean;
  showCloneThreadButton?: boolean;
}) {
  const {
    threadId,
    selectedArtifact,
    chatStatus,
    messages,
    setMessages,
    input,
    setInput,
    setError,
    handleInputChange,
  } = useChatState(initalMessages);

  const [pendingThread] = useAtom(pendingThreadAtom);
  const [selectedModel] = useAtom(modelAtom);
  const [instructions] = useAtom(instructionsAtom);

  // Check if this is a pending thread
  const isPendingThread = threadId?.startsWith("pending-");
  const isUploading = isPendingThread && pendingThread?.status === "uploading";

  // Custom hooks
  useThreadStream({
    threadId,
    viewOnly,
    messagesAreBeingFetched,
    onMessagesUpdate: setMessages,
    onError: setError,
  });

  const { submitMessage, stop, isSubmitting } = useMessageSubmission({
    threadId,
    onMessageAdd: (message) => setMessages((prev) => [...prev, message]),
    onError: setError,
  });

  const { splitPosition, handleMouseDown } = useResizeLayout();

  // Convert messages for component compatibility
  const convertedMessages = convertChatMessagesToMessages(messages);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await submitMessage(input);
      if (success) {
        setInput("");
      }
    },
    [input, submitMessage, setInput]
  );

  // Show uploading indicator for pending threads
  const showUploadingIndicator = isUploading && convertedMessages.length > 0;

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!threadId) return;

      try {
        const response = await api.threads.retryMessage({
          threadId,
          messageId,
          model: selectedModel.name,
          instructions: instructions,
        });

        if (response.success) {
          // Implement the same deletion logic as the server
          setMessages((prev) => {
            // Find the index of the message being retried
            const messageToRetryIndex = prev.findIndex(
              (msg) => msg.id === messageId
            );

            if (messageToRetryIndex === -1) {
              // If message not found, return previous state unchanged
              return prev;
            }

            // Start collecting indices of messages to remove
            const indicesToRemove: number[] = [];

            // 1. Add all messages that come after the retry message
            for (let i = messageToRetryIndex + 1; i < prev.length; i++) {
              indicesToRemove.push(i);
            }

            // 2. Add the retry message itself
            indicesToRemove.push(messageToRetryIndex);

            // 3. Go backwards from the retry message and collect all consecutive assistant/tool messages
            // until we hit a user message or reach the beginning
            let currentIndex = messageToRetryIndex - 1;
            while (currentIndex >= 0) {
              const currentMessage = prev[currentIndex];

              // If we hit a user message, stop - this is where we want to restart from
              if (currentMessage.role === "user") {
                break;
              }

              // If it's an assistant or tool message, add it to removal list
              if (
                currentMessage.role === "assistant" ||
                currentMessage.role === "tool"
              ) {
                indicesToRemove.unshift(currentIndex); // Add to beginning to maintain order
                currentIndex--;
              } else {
                // If we hit any other role (like system), stop here
                break;
              }
            }

            // Sort indices in descending order to remove from end to beginning
            // This prevents index shifting issues
            const sortedIndices = [...new Set(indicesToRemove)].sort(
              (a, b) => b - a
            );

            // Create new array without the messages to be removed
            const newMessages = prev.filter(
              (_, index) => !sortedIndices.includes(index)
            );

            return newMessages;
          });
        }
      } catch (error: any) {
        console.error("Error retrying message:", error);
        toast.error(
          error.message || "Failed to retry message. Please try again."
        );
      }
    },
    [threadId, setMessages, selectedModel, instructions]
  );

  return (
    <div id="chat-container" className="flex h-full w-full relative">
      {selectedArtifact && (
        <>
          <ArtifactViewer
            artifact={selectedArtifact}
            splitPosition={splitPosition}
          />
          <div
            className="w-[2px] hover:w-1 h-full cursor-col-resize bg-secondary transition-all"
            onMouseDown={handleMouseDown}
          />
        </>
      )}

      <div
        className="flex flex-col h-full min-w-[400px] relative"
        style={{
          width: selectedArtifact ? `${splitPosition}%` : "100%",
        }}
      >
        {thread && <ThreadHeader />}

        <div className="flex-1">
          <ChatMessagesList
            messages={convertedMessages}
            status={isUploading ? "submitted" : chatStatus}
            showSkeletons={messagesAreBeingFetched && !isPendingThread}
            onRetry={handleRetry}
          />

          {showUploadingIndicator && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">
                Creating thread and uploading files...
              </span>
            </div>
          )}
        </div>

        {!viewOnly && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <ChatInputForm
              input={input}
              setInput={setInput}
              handleInputChange={handleInputChange}
              onSubmit={handleSubmit}
              stop={stop}
              isGenerating={isSubmitting || isUploading}
              hasThread={true}
            />
          </div>
        )}

        {showCloneThreadButton && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <CloneThreadButton threadId={threadId as string} />
          </div>
        )}
      </div>
    </div>
  );
}
