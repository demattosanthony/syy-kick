// Types
import { ChatMessage } from "@/types/chat";

// Atoms
import {
  alreadyAutoSelectedArtifactAtom,
  selectedArtifactAtom,
  chatStatusAtom,
} from "@/atoms/chat";

// Hooks
import { useAtom } from "jotai";
import { useParams } from "react-router";
import { useEffect, useState, useCallback } from "react";
import {
  useResizeLayout,
  useThreadStream,
  useMessageSubmission,
} from "../hooks";

// Components
import { Thread } from "@/types/chat";
import ThreadHeader from "./thread-header";
import {
  ArtifactViewer,
  ChatInputForm,
  ChatMessagesList,
} from "@/features/chat/messages/components";
import { CloneThreadButton } from "./clone-thread-button";

// Utils
import { convertChatMessagesToMessages } from "../utils/message-conversion";

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
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const [, setAlreadyOpenedArtifact] = useAtom(alreadyAutoSelectedArtifactAtom);
  const [chatStatus, setChatStatus] = useAtom(chatStatusAtom);
  console.log("chatStatus", chatStatus);

  // Local state for messages and error
  const [messages, setMessages] = useState<ChatMessage[]>(initalMessages);
  const [input, setInput] = useState("");
  const [, setError] = useState<string | null>(null);

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

  // Convert messages for component compatibility
  console.log("messages", messages);
  const convertedMessages = convertChatMessagesToMessages(messages);
  console.log("convertedMessages", convertedMessages);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await submitMessage(input);
      if (success) {
        setInput("");
      }
    },
    [input, submitMessage]
  );

  // Update messages when initialMessages change
  useEffect(() => {
    setMessages(initalMessages);
  }, [initalMessages]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setSelectedArtifact(null);
      setAlreadyOpenedArtifact(null);
      setChatStatus("ready");
    };
  }, [threadId, setChatStatus, setSelectedArtifact, setAlreadyOpenedArtifact]);

  const { splitPosition, handleMouseDown } = useResizeLayout();

  return (
    <div id="chat-container" className="flex h-full w-full relative">
      {selectedArtifact && (
        <>
          <ArtifactViewer
            artifact={selectedArtifact}
            splitPosition={splitPosition}
            messages={convertedMessages}
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
            status={chatStatus}
            showSkeletons={messagesAreBeingFetched}
          />
        </div>

        {!viewOnly && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <ChatInputForm
              input={input}
              setInput={setInput}
              handleInputChange={handleInputChange}
              onSubmit={handleSubmit}
              stop={stop}
              isGenerating={isSubmitting}
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
