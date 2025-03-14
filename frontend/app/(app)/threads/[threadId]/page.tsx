"use client";

import { useThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function ThreadsPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ threadId: string }>();
  const isNew = searchParams.get("new") === "true";
  const threadId = params.threadId;

  const { data: thread, isLoading } = useThreadQuery(threadId, isNew);

  const initalMessages = useMemo(() => {
    if (isNew || !thread) return [];

    return mapThreadMessagesToMessages(thread);
  }, [isNew, thread]);

  return (
    <ChatThread
      initalMessages={initalMessages}
      thread={thread}
      messagesAreBeingFetched={isLoading && !isNew}
    />
  );
}
