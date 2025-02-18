"use client";

import React from "react";
import { Check, Copy, Search } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

const MessageBubble = (
  { content, isUser, onCopy, copied }: MessageBubbleProps // Removed React.memo
) => (
  <div
    className={`group mb-4 flex w-full ${
      isUser ? "justify-end" : "justify-start"
    }`}
  >
    <div
      className={`
        relative flex flex-col rounded-lg p-2
        ${
          isUser
            ? "bg-primary text-white dark:text-black max-w-[85%]"
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

import { Message } from "ai/react";
import MarkdownViewer from "../MarkdownViewer";
import { ThinkingDropdown } from "./ThinkingDropdown";

const ToolInvocation = ({ tool, index }: { tool: any; index: number }) => (
  <div className="flex flex-col gap-2 my-1">
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Searching</p>

      <Badge
        key={index}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal w-fit"
        variant={"secondary"}
      >
        <Search className="w-3 h-3" />
        {tool.args?.query}
        {tool.state === "call" && (
          <span className="inline-flex">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce delay-100">.</span>
            <span className="animate-bounce delay-200">.</span>
          </span>
        )}
        {/* {tool.state === "result" && <span className="text-green-500">✓</span>} */}
        {tool.state === "partial-call" && (
          <span className="text-yellow-500">⋯</span>
        )}
      </Badge>
    </div>

    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Reading</p>

      {tool.result && (
        <div className="flex gap-1">
          {tool.result.dataForFrontend.map((result: any, idx: number) => (
            <Badge
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal max-w-[300px] line-clamp-1"
              variant={"secondary"}
              onClick={() => window.open(result.url, "_blank")}
            >
              {result.source}
            </Badge>
          ))}
        </div>
      )}
    </div>
  </div>
);

const AssistantMessage = ({
  message,
  showEye,
}: {
  message: Message;
  showEye: boolean;
}) => {
  return (
    <div className="my-2 flex flex-col justify-start">
      <div className="flex gap-2">
        <div className="mr-[1px] w-[32px] h-[32px]">
          {showEye ? <Syyclops3dEye size={32} animate={false} /> : null}
        </div>

        <div
          className="
            max-w-full
            md:max-w-[750px]
            overflow-hidden
            bg-background
            break-words
            mt-[1px]
          "
        >
          {message.reasoning && (
            <ThinkingDropdown>
              <MarkdownViewer content={message.reasoning || ""} />
            </ThinkingDropdown>
          )}

          <MarkdownViewer content={message.content || ""} />

          {message.toolInvocations?.map(
            (tool, index) =>
              tool.toolName === "search_documents" && (
                <div key={index} className="flex flex-wrap">
                  <ToolInvocation tool={tool} index={index} />
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
};

import ChatAttachment from "./ChatAttachment";

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
    <div className="mb-4 ">
      {message.experimental_attachments?.map((attachment, idx) => (
        <ChatAttachment key={idx} attachment={attachment} />
      ))}
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

import { useEffect } from "react";
import { MessageRole } from "@/types/chat";
import Syyclops3dEye from "../syy-eye";
import { Badge } from "../ui/badge";
import Link from "next/link";

const LoadingMessage = React.memo(() => {
  return (
    <div className="mb-4 flex flex-col justify-start">
      <div className="flex gap-2">
        <div className="mr-[1px] w-[32px] h-[32px]">
          <Syyclops3dEye size={32} animate={false} />
        </div>

        <div className="flex items-center gap-1 text-muted-foreground mt-3">
          <span className="animate-bounce">•</span>
          <span className="animate-bounce delay-100">•</span>
          <span className="animate-bounce delay-200">•</span>
        </div>
      </div>
    </div>
  );
});
LoadingMessage.displayName = "LoadingMessage";

// Memo helps to prevent unnecessary re-renders. Fixes issue when lots of messages and user types in chat input form is laggy
const ChatMessagesList = React.memo(
  ({ messages, isLoading }: { messages: Message[]; isLoading: boolean }) => {
    useEffect(() => {
      const container = document.querySelector(".overflow-y-auto");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, [messages.length]);

    // Example: show loading after the user's last message
    const lastMessage = messages[messages.length - 1];
    const showLoadingState =
      isLoading && lastMessage?.role === MessageRole.user;

    return (
      <div className="flex-1 w-full h-full relative">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="max-w-[840px] mx-auto pt-20 p-4">
            {messages.map((message, index) => {
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
                />
              );
            })}
            {showLoadingState && <LoadingMessage />}
          </div>
        </div>
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";

export default ChatMessagesList;
