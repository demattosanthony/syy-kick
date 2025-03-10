"use client";

import React, { useState } from "react";
import {
  Check,
  CheckIcon,
  ChevronDown,
  Copy,
  GitBranch,
  Pencil,
  X,
} from "lucide-react";

type ExtendedMessage = Message & {
  branchLevel?: number;
  parentId?: string;
};

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  onCopy?: () => void;
  copied?: boolean;
}

const BranchSelector = ({
  messageId,
  branches,
  onSelectBranch,
  activeBranchId,
}: {
  messageId: string;
  branches: ExtendedMessage[];
  onSelectBranch: (messageId: string) => void;
  activeBranchId?: string;
}) => {
  if (!branches || branches.length <= 1) return null;

  // Sort branches by creation date
  const sortedBranches = [...branches].sort((a, b) => {
    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  });

  return (
    <div className="mt-2 flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1 border-dashed border-primary/50"
          >
            <GitBranch className="h-3 w-3" />
            <span>Message Versions ({branches.length})</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          {sortedBranches.map((branch, index) => (
            <DropdownMenuItem
              key={branch.id}
              className={cn(
                activeBranchId === branch.id ? "bg-muted" : "",
                "flex flex-col items-start gap-1 py-2"
              )}
              onClick={() => onSelectBranch(branch.id)}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium">Version {index + 1}</span>
                {branch.id === messageId && (
                  <span className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded">
                    Current
                  </span>
                )}
              </div>
              {branch.content && (
                <span className="text-xs text-muted-foreground truncate max-w-full">
                  "{branch.content.substring(0, 30)}
                  {branch.content.length > 30 ? "..." : ""}"
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

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

// Update the UserMessage component
const UserMessage = ({
  message,
  threadId,
  branches,
  onSelectBranch,
  activeBranchId,
}: {
  message: Message;
  threadId: string;
  branches?: ExtendedMessage[];
  onSelectBranch?: (messageId: string) => void;
  activeBranchId?: string;
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>(
    message.content || ""
  );

  const { mutate: editMessage, isPending } = useEditMessage();

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content || "");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(message.content || "");
  };

  const handleSave = () => {
    console.log("Editing message:", message);

    if (editedContent.trim() && editedContent !== message.content) {
      editMessage({
        threadId,
        messageId: message.id,
        content: editedContent,
        attachments: message.experimental_attachments,
      });
    }
    setIsEditing(false);
  };

  // Log branches to debug
  console.log(`Message ${message.id} branches:`, branches);

  return (
    <div className="mb-4">
      {message.experimental_attachments?.map((attachment, idx) => (
        <ChatAttachment key={idx} attachment={attachment} />
      ))}

      {isEditing ? (
        <div className="flex flex-col gap-2 max-w-[85%] ml-auto">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[100px] resize-none"
            placeholder="Edit your message..."
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !editedContent.trim()}
            >
              {isPending ? (
                "Saving..."
              ) : (
                <>
                  <CheckIcon className="w-4 h-4 mr-1" /> Save
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        message.content && (
          <div className="group relative">
            <MessageBubble
              content={message.content || ""}
              isUser={true}
              onCopy={handleCopy}
              copied={copied}
            />
            <div className="absolute -bottom-6 right-0 group-hover:opacity-100 opacity-0 transition-all duration-200">
              <Pencil
                className="w-4 h-4 cursor-pointer text-primary"
                onClick={handleEdit}
              />
            </div>
          </div>
        )
      )}

      {/* Always show branch selector if there are branches */}
      {!isEditing && branches && branches.length > 1 && onSelectBranch && (
        <BranchSelector
          messageId={message.id}
          branches={branches}
          onSelectBranch={onSelectBranch}
          activeBranchId={activeBranchId}
        />
      )}
    </div>
  );
};

import { useEffect } from "react";
import { MessageRole } from "@/types/chat";
import Syyclops3dEye from "./syy-eye";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Message } from "ai";
import AssistantMessage from "./assistant-message";
import {
  AssistantSkeletonMessage,
  UserSkeletonMessage,
} from "./message-skeletons";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEditMessage } from "../api/edit-messsage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const ChatMessagesList = React.memo(
  ({
    messages,
    isLoading,
    threadId,
    showSkeletons = false,
    onSelectBranch,
    activeBranchMessageId,
  }: {
    messages: Message[];
    isLoading: boolean;
    threadId: string;
    showSkeletons?: boolean;
    onSelectBranch?: (messageId: string) => void;
    activeBranchMessageId?: string;
  }) => {
    useEffect(() => {
      const container = document.querySelector(".overflow-y-auto");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, [messages.length]);

    // Find all root user messages - these are potential branches
    const rootUserMessages = React.useMemo(() => {
      return (messages as ExtendedMessage[]).filter(
        (msg) => msg.role === "user" && !msg.parentId
      );
    }, [messages]);

    console.log("Root user messages:", rootUserMessages);

    // If there are multiple root user messages, treat them as branches of each other
    const userMessagesWithBranches = React.useMemo(() => {
      const result = new Map<string, ExtendedMessage[]>();

      if (rootUserMessages.length > 1) {
        // For each root user message, add all root user messages as its branches
        rootUserMessages.forEach((msg) => {
          result.set(msg.id, rootUserMessages);
        });
      }

      return result;
    }, [rootUserMessages]);

    // Filter messages to display based on active branch
    const displayedMessages = React.useMemo(() => {
      if (!activeBranchMessageId || rootUserMessages.length <= 1) {
        // If no active branch or only one root message, show all messages
        return messages;
      }

      // Find the active root message
      const activeRootMessage = rootUserMessages.find(
        (msg) => msg.id === activeBranchMessageId
      );

      if (!activeRootMessage) {
        // If active branch is not a root message, show all messages
        return messages;
      }

      // Filter out other root user messages and their responses
      // First, create a set of IDs to exclude
      const excludeIds = new Set<string>();

      // Add all root user messages except the active one
      rootUserMessages.forEach((msg) => {
        if (msg.id !== activeBranchMessageId) {
          excludeIds.add(msg.id);

          // Also find and exclude any direct responses to this message
          messages.forEach((response) => {
            if ((response as ExtendedMessage).parentId === msg.id) {
              excludeIds.add(response.id);
            }
          });
        }
      });

      // Return only messages that aren't in the exclude set
      return messages.filter((msg) => !excludeIds.has(msg.id));
    }, [messages, rootUserMessages, activeBranchMessageId]);

    console.log("Displayed messages:", displayedMessages);

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
              // Show filtered messages
              displayedMessages.map((message, index) => {
                const nextMessage = displayedMessages[index + 1];
                const showEye =
                  message.role !== MessageRole.user &&
                  (!nextMessage || nextMessage.role === MessageRole.user) &&
                  !isLoading;

                // Get branches for this message if it's a user message
                const branches =
                  message.role === MessageRole.user
                    ? userMessagesWithBranches.get(message.id)
                    : undefined;

                return (
                  <div key={message.id} id={`message-${message.id}`}>
                    {message.role === MessageRole.user ? (
                      <UserMessage
                        message={message}
                        threadId={threadId}
                        branches={branches}
                        onSelectBranch={onSelectBranch}
                        activeBranchId={activeBranchMessageId}
                      />
                    ) : (
                      <AssistantMessage
                        message={message}
                        showEye={showEye}
                        messages={displayedMessages}
                      />
                    )}
                  </div>
                );
              })
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
