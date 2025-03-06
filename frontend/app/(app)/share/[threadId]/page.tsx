"use client";

import { usePublicThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { Message } from "ai/react";
import { redirect, useParams } from "next/navigation";
import { useMemo } from "react";

export default function ShareThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const { data: thread, isFetched, isLoading } = usePublicThreadQuery(threadId);

  const initalMessages = useMemo(() => {
    if (!thread) return [];

    return (
      thread?.messages?.map(
        (message): Message => ({
          content: message.text,
          role: message.role as "user" | "assistant",
          id: message.id,
          createdAt: message.createdAt
            ? new Date(message.createdAt)
            : undefined,
          reasoning: message.reasoning,
          experimental_attachments: message.attachments?.map((attachment) => ({
            name: attachment.fileName,
            url: attachment.url,
            file_key: attachment.fileKey,
            contentType: attachment.mimeType,
          })),
          toolInvocations: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            toolName: toolCall.toolName,
            status: toolCall.status,
            result: toolCall.result,
            args: toolCall.args,
            toolCallId: toolCall.toolCallId,
            state: "result" as const,
          })),
        })
      ) ?? []
    );
  }, [thread]);

  if (isFetched && thread?.isPublic !== true) {
    return redirect("/");
  }

  return (
    <ChatThread
      initalMessages={initalMessages}
      thread={thread}
      viewOnly
      messagesAreBeingFetched={isLoading}
    />
  );
}
