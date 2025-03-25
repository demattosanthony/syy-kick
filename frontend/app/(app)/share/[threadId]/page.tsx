"use server";

import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import api from "@/lib/api";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ threadId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;

  const thread = await api.threads.getPublicThread(threadId).catch(() => null);

  if (!thread || thread.isPublic !== true) {
    redirect("/");
  }

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

export default async function ShareThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const threadId = (await params).threadId;

  const thread = await api.threads.getPublicThread(threadId).catch(() => null);
  const user = await api.auth.me();

  if (!thread || thread.isPublic !== true) {
    redirect("/");
  }

  const initialMessages = thread ? mapThreadMessagesToMessages(thread) : [];

  const isAllowedToCloneThread =
    !thread.organizationId ||
    !!user?.organizations?.some((org) => org.id === thread.organizationId);

  return (
    <ChatThread
      initalMessages={initialMessages}
      thread={thread}
      viewOnly
      showCloneThreadButton={isAllowedToCloneThread}
    />
  );
}
