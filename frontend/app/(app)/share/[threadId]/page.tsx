"use client";

import { usePublicThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { redirect, useParams } from "next/navigation";
import { useMemo } from "react";

export default function ShareThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const { data: thread, isFetched, isLoading } = usePublicThreadQuery(threadId);

  const initalMessages = useMemo(() => {
    if (!thread) return [];

    return mapThreadMessagesToMessages(thread);
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
