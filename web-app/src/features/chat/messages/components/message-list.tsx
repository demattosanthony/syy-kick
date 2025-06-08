import React, { useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Message as UIMessage,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageAvatar,
} from "@/components/ui/message";
import { Button } from "@/components/ui/button";

import ChatAttachment from "./chat-attachment";

const UserMessage = React.memo(
  ({ message }: { message: Message }) => {
    const [copied, setCopied] = React.useState<boolean>(false);
    const [isHovering, setIsHovering] = useState(false);

    const handleCopy = () => {
      if (message.content) {
        navigator.clipboard.writeText(message.content).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
    };

    return (
      <div className="mb-2">
        {message.experimental_attachments &&
          message.experimental_attachments.length > 0 && (
            <div className="flex justify-end mb-2">
              <div className="flex flex-col gap-2 items-end">
                {message.experimental_attachments.map(
                  (attachment: any, idx: number) => (
                    <ChatAttachment
                      key={`${attachment.name}-${
                        attachment.contentType || attachment.mimeType || ""
                      }-${idx}`}
                      attachment={attachment}
                    />
                  )
                )}
              </div>
            </div>
          )}
        {message.content && (
          <UIMessage
            className="justify-end group"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <div className="flex w-full flex-col gap-2 items-end">
              <MessageContent className="bg-[#242628] dark:bg-input text-white dark:text-white max-w-[515px] whitespace-pre-wrap">
                {message.content}
              </MessageContent>

              <MessageActions
                className={`self-end transition-opacity duration-200 ${
                  isHovering ? "opacity-100" : "opacity-0"
                }`}
              >
                <MessageAction
                  tooltip={copied ? "Copied!" : "Copy to clipboard"}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </MessageAction>
              </MessageActions>
            </div>
          </UIMessage>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    const prevMessage = prevProps.message;
    const nextMessage = nextProps.message;

    // Compare message content
    if (prevMessage.content !== nextMessage.content) {
      return false;
    }

    // Compare attachments
    const prevAttachments = prevMessage.experimental_attachments || [];
    const nextAttachments = nextMessage.experimental_attachments || [];

    if (prevAttachments.length !== nextAttachments.length) {
      return false;
    }

    // Compare attachments by name and content type only, ignore URL changes
    // This prevents re-renders when URL changes from blob to server URL
    for (let i = 0; i < prevAttachments.length; i++) {
      const prev = prevAttachments[i] as any;
      const next = nextAttachments[i] as any;

      if (
        prev.name !== next.name ||
        (prev.contentType || prev.mimeType) !==
          (next.contentType || next.mimeType)
      ) {
        return false;
      }
    }

    return true; // Props are equal, skip re-render
  }
);

UserMessage.displayName = "UserMessage";

import { MessageRole } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Message } from "ai";
import AssistantMessage from "./assistant-message";
import {
  AssistantSkeletonMessage,
  UserSkeletonMessage,
} from "./message-skeletons";
import { ChatContainer } from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import logo from "@/assets/logo192.png";

const LoadingMessage = React.memo(() => (
  <UIMessage className="justify-start">
    <MessageAvatar src={logo} alt="AI" fallback="AI" className="animate-spin" />
  </UIMessage>
));

LoadingMessage.displayName = "LoadingMessage";

// Memo helps to prevent unnecessary re-renders. Fixes issue when lots of messages and user types in chat input form is laggy
const ChatMessagesList = React.memo(
  ({
    messages,
    status,
    showSkeletons = false,
  }: {
    messages: Message[];
    status: "error" | "submitted" | "streaming" | "ready";
    showSkeletons?: boolean;
  }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    const lastMessage = useMemo(() => {
      return messages[messages.length - 1] || null;
    }, [messages]);

    return (
      <div className="flex-1 w-full h-full relative">
        <ChatContainer
          className={cn(
            "absolute inset-0 overflow-y-auto p-4 flex flex-col",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent pt-20"
          )}
          autoScroll
          ref={chatContainerRef}
          scrollToRef={bottomRef}
        >
          <div className="max-w-[840px] mx-auto w-full flex-1 flex flex-col">
            {showSkeletons ? (
              // Show skeleton messages when loading the thread
              <>
                <UserSkeletonMessage />
                <AssistantSkeletonMessage />
                <UserSkeletonMessage />
                <AssistantSkeletonMessage />
              </>
            ) : (
              // Show actual messages
              messages.map((message, index) => {
                const nextMessage = messages[index + 1];
                const prevMessage = messages[index - 1];
                const showEye =
                  message.role !== MessageRole.user &&
                  (!nextMessage || nextMessage.role === MessageRole.user);

                const showActions =
                  message.role !== MessageRole.user &&
                  (!nextMessage || nextMessage.role === MessageRole.user);

                // Add spacing between consecutive assistant messages
                const isConsecutiveAssistantMessage =
                  message.role !== MessageRole.user &&
                  prevMessage &&
                  prevMessage.role !== MessageRole.user;

                return message.role === MessageRole.user ? (
                  <UserMessage key={index} message={message} />
                ) : (
                  <div
                    key={index}
                    className={isConsecutiveAssistantMessage ? "mt-4" : ""}
                  >
                    <AssistantMessage
                      message={message}
                      showEye={showEye}
                      showActions={showActions}
                      messages={messages}
                    />
                  </div>
                );
              })
            )}
            {(status === "submitted" ||
              lastMessage?.role === MessageRole.user) && <LoadingMessage />}
          </div>
        </ChatContainer>

        <div className="absolute inset-x-0 bottom-2 pointer-events-none">
          <div className="max-w-[640px] mx-auto relative h-0">
            <div className="absolute right-0 bottom-0 pointer-events-auto">
              <ScrollButton
                containerRef={chatContainerRef}
                className="shadow-sm"
                variant={"outline"}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";

export default ChatMessagesList;
