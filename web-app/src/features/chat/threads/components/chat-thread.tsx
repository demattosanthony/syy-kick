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
import {
  instructionsAtom,
  modelAtom,
  pendingThreadAtom,
  thinkingAtom,
} from "@/atoms/chat";

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
  const [thinking] = useAtom(thinkingAtom);
  const [instructions] = useAtom(instructionsAtom);

  // Check if this is a pending thread
  const isPendingThread = threadId?.startsWith("pending-");
  const isProcessing =
    isPendingThread && pendingThread?.status === "processing";

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

  // Show processing indicator for pending threads
  const showProcessingIndicator = isProcessing && convertedMessages.length > 0;

  const handleRetry = useCallback(
    async (messageId: string) => {
      if (!threadId) return;

      try {
        const response = await api.threads.retryMessage({
          threadId,
          messageId,
          model: selectedModel.name,
          instructions: instructions,
          thinking: thinking,
        });

        if (response.success) {
          // Remove all assistant messages after the last user message
          setMessages((prev) => {
            // Find the last user message index
            let lastUserMessageIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === "user") {
                lastUserMessageIndex = i;
                break;
              }
            }

            // Keep only messages up to and including the last user message
            return prev.slice(0, lastUserMessageIndex + 1);
          });
        }
      } catch (error: any) {
        console.error("Error retrying message:", error);
        toast.error(
          error.message || "Failed to retry message. Please try again."
        );
      }
    },
    [threadId, setMessages, selectedModel, instructions, thinking]
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
            status={isProcessing ? "submitted" : chatStatus}
            showSkeletons={messagesAreBeingFetched && !isPendingThread}
            onRetry={handleRetry}
          />

          {showProcessingIndicator && (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">
                Creating thread and processing files...
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
              isGenerating={isSubmitting || isProcessing}
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
