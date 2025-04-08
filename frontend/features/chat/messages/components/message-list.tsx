"use client";

import React, { useRef } from "react";
import { Check, Copy } from "lucide-react";
import Image from "next/image";

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

const MessageBubble = ({
  content,
  isUser,
  onCopy,
  copied,
}: MessageBubbleProps) => (
  <div
    className={`group flex w-full ${isUser ? "justify-end" : "justify-start"}`}
  >
    <div
      className={`
        relative flex flex-col rounded-lg p-2
        ${
          isUser
            ? "bg-primary text-white dark:text-black max-w-[515px]"
            : "bg-background max-w-full"
        }
      `}
      style={{
        whiteSpace: isUser ? "pre-wrap" : "normal",
      }}
    >
      <div
        className="
          break-words
          whitespace-pre-wrap
          w-full
          overflow-hidden
        "
      >
        {content}
      </div>

      {isUser && onCopy && (
        <div className="absolute -bottom-6 right-0 group-hover:opacity-100 opacity-0 transition-all duration-200">
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy
              className="w-4 h-4 cursor-pointer text-primary"
              onClick={onCopy}
            />
          )}
        </div>
      )}
    </div>
  </div>
);

import ChatAttachment from "./chat-attachment";

const UserMessage = ({ message }: { message: Message }) => {
  // Removed React.memo
  const [copied, setCopied] = React.useState<boolean>(false);

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
              {message.experimental_attachments.map((attachment, idx) => (
                <ChatAttachment key={idx} attachment={attachment} />
              ))}
            </div>
          </div>
        )}
      {message.content && (
        <MessageBubble
          content={message.content || ""}
          isUser={true}
          onCopy={handleCopy}
          copied={copied}
        />
      )}
    </div>
  );
};

import { MessageRole } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Message } from "ai";
import AssistantMessage from "./assistant-message";
import {
  AssistantSkeletonMessage,
  UserSkeletonMessage,
} from "./message-skeletons";
import { Loader } from "@/components/ui/loader";
import { ChatContainer } from "@/components/ui/chat-container";

const LoadingMessage = React.memo(
  ({ status }: { status: "error" | "submitted" | "streaming" | "ready" }) => {
    return (
      <div className="mb-4 mt flex flex-col justify-start">
        <div className="flex items-center">
          {status === "submitted" && (
            <div className="w-[22px] h-[22px] mr-2">
              <Image src="/logo192.png" width={22} height={22} alt="" />
            </div>
          )}
          <div className="flex h-full items-start justify-center">
            {status === "submitted" ? (
              <Loader variant="text-shimmer" text={"Thinking..."} size="lg" />
            ) : (
              <Loader variant="wave" size="lg" />
            )}
          </div>
        </div>
      </div>
    );
  }
);

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

    return (
      <div className="flex-1 w-full h-full relative">
        <ChatContainer
          className={cn(
            "absolute inset-0 overflow-y-auto p-4 flex flex-col",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent pt-20"
          )}
          autoScroll
          ref={chatContainerRef}
        >
          <div className="max-w-[840px] mx-auto w-full flex-1 flex flex-col gap-2">
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
                const showEye =
                  message.role !== MessageRole.user &&
                  (!nextMessage || nextMessage.role === MessageRole.user);

                return message.role === MessageRole.user ? (
                  <UserMessage key={index} message={message} />
                ) : (
                  <AssistantMessage
                    key={index}
                    message={message}
                    showEye={showEye}
                    messages={messages}
                  />
                );
              })
            )}
            {status === "submitted" && <LoadingMessage status={status} />}
          </div>
        </ChatContainer>
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";

export default ChatMessagesList;
