"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

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

import ChatAttachment from "./chat-attachment";

// Add new interface for tree-based messages
interface MessageTreeProps {
  messages: MessageNode[];
  currentBranchId?: string;
  onBranchSelect: (messageId: string) => void;
}

// New component to show branch selection UI
const MessageBranchSelector = ({
  message,
  onSelect,
  isSelected,
}: {
  message: MessageNode;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) => (
  <div
    className={cn(
      "px-2 py-1 text-sm rounded cursor-pointer hover:bg-secondary/50",
      isSelected && "bg-secondary"
    )}
    onClick={() => onSelect(message.id)}
  >
    {message.text?.slice(0, 50)}...
  </div>
);

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
    <div className="mb-4">
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
import { MessageNode, MessageRole } from "@/types/chat";
import Syyclops3dEye from "./syy-eye";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Message } from "ai";
import AssistantMessage from "./assistant-message";
import {
  AssistantSkeletonMessage,
  UserSkeletonMessage,
} from "./message-skeletons";

const LoadingMessage = React.memo(() => {
  return (
    <div className="mb-4 flex flex-col justify-start">
      <div className="flex items-center gap-1">
        <div className="w-[32px] h-full">
          <Syyclops3dEye size={22} animate={false} />
        </div>

        <div className="flex items-center rounded-lg bg-background">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="inline-block w-2 h-2 rounded-full bg-current"
                initial={{ opacity: 0.3, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatType: "reverse",
                  delay: index * 0.2,
                }}
              >
                &nbsp;
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

LoadingMessage.displayName = "LoadingMessage";

// Memo helps to prevent unnecessary re-renders. Fixes issue when lots of messages and user types in chat input form is laggy
const ChatMessagesList = React.memo(
  ({
    messages,
    isLoading,
    showSkeletons = false,
  }: {
    messages: MessageNode[];
    isLoading: boolean;
    showSkeletons?: boolean;
  }) => {
    useEffect(() => {
      const container = document.querySelector(".overflow-y-auto");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, [messages.length]);

    const [currentBranchId, setCurrentBranchId] = useState<string>();

    // Function to get current branch messages
    const getCurrentBranchMessages = () => {
      if (!currentBranchId) {
        return messages;
      }

      // Find the selected message and its ancestors
      const messageChain: MessageNode[] = [];
      const findMessageChain = (
        msgs: MessageNode[],
        targetId: string
      ): boolean => {
        for (const msg of msgs) {
          if (msg.id === targetId) {
            messageChain.push(msg);
            return true;
          }
          if (findMessageChain(msg.children, targetId)) {
            messageChain.push(msg);
            return true;
          }
        }
        return false;
      };

      findMessageChain(messages, currentBranchId);
      return messageChain.reverse();
    };

    const currentMessages = getCurrentBranchMessages();

    return (
      <div className="flex-1 w-full h-full relative">
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
        >
          <div className="max-w-[840px] mx-auto pt-20 p-4 flex flex-col gap-2">
            {showSkeletons ? (
              // Show skeleton messages when loading the thread
              <>
                <UserSkeletonMessage />
                <AssistantSkeletonMessage />
                <UserSkeletonMessage />
                <AssistantSkeletonMessage />
              </>
            ) : (
              <>
                {currentMessages.map((message, index) => {
                  const nextMessage = currentMessages[index + 1];
                  const showEye =
                    message.role !== MessageRole.user &&
                    (!nextMessage || nextMessage.role === MessageRole.user) &&
                    !isLoading;

                  return (
                    <div key={message.id} className="relative">
                      {message.children.length > 0 && (
                        <div className="absolute right-0 top-0 z-10">
                          <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-2">
                            <div className="text-xs text-muted-foreground mb-1">
                              Alternative responses:
                            </div>
                            {message.children.map((child) => (
                              <MessageBranchSelector
                                key={child.id}
                                message={child}
                                onSelect={setCurrentBranchId}
                                isSelected={currentBranchId === child.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {message.role === MessageRole.user ? (
                        <UserMessage message={message} />
                      ) : (
                        <AssistantMessage
                          message={message}
                          showEye={showEye}
                          messages={currentMessages}
                        />
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {isLoading && !showSkeletons && <LoadingMessage />}
          </div>
        </div>
      </div>
    );
  }
);

ChatMessagesList.displayName = "ChatMessagesList";

export default ChatMessagesList;
