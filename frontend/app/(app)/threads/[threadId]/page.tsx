"use server";

import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { getThread } from "@/app/actions";

export default async function ThreadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const isNew = resolvedSearchParams.new === "true";
  const threadId = resolvedParams.threadId;

  // Only fetch the thread if it's not a new thread
  const thread = isNew ? null : await getThread(threadId);

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
