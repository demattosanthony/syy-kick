"use client";

import ChatThread from "@/components/chat/chat-thread";
import { useThreadQuery } from "@/queries/queries";
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
      thread?.messages?.map((message) => ({
        content: message.content?.text || "",
        role: message.role as "user" | "assistant",
        id: message.id,
        createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
        reasoning: message.reasoning,
        experimental_attachments:
          message.content?.type === "image" || message.content?.type === "file"
            ? [
                {
                  name: message.content.file_metadata?.filename,
                  url: message.content?.data || "",
                  file_key: message.content.file_metadata?.file_key,
                  contentType: message.content.file_metadata?.mime_type,
                },
              ]
            : [],
      })) ?? []
    );
  }, [isNew, thread]);

  return <ChatThread initalMessages={initalMessages} />;
}
