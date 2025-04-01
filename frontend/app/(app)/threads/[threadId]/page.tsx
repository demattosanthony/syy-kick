"use client";

import { useThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { useParams, useSearchParams } from "next/navigation";

export default function ThreadsPage() {
  const params = useParams<{
    threadId: string;
  }>();
  const searchParams = useSearchParams();

  const isNew = searchParams.get("new") === "true";
  const threadId = params.threadId;

  // Only fetch the thread if it's not a new thread
  const { data: thread } = useThreadQuery(threadId, isNew);

  const initialMessages =
    isNew || !thread ? [] : mapThreadMessagesToMessages(thread);

  return (
    <ChatThread
      initalMessages={initialMessages}
      thread={thread}
      messagesAreBeingFetched={false}
    />
  );
}
