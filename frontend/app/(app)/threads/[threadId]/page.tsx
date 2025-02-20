"use client";

import ChatThread from "@/components/chat/chat-thread";
import { useThreadQuery } from "@/queries/queries";
import { Message } from "ai/react";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function ThreadsPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ threadId: string }>();
  const isNew = searchParams.get("new") === "true";
  const threadId = params.threadId;

  const { data: thread } = useThreadQuery(threadId, isNew);

  const initalMessages = useMemo(() => {
    if (isNew) return [];

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
  }, [isNew, thread]);

  return <ChatThread initalMessages={initalMessages} thread={thread} />;
}
