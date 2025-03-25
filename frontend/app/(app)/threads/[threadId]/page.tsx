"use server";

import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import api from "@/lib/api";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ threadId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;

  const thread = await api.threads.getThread(threadId);
  const lastMessage = thread.messages[thread.messages.length - 1];

  return {
    title: thread.title + " - Syykick",
    description: lastMessage?.text.slice(0, 250),
    openGraph: {
      title: thread.title + " - Syykick",
      description: lastMessage?.text.slice(0, 250),
    },
  };
}

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
  const thread = isNew ? undefined : await api.threads.getThread(threadId);

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
