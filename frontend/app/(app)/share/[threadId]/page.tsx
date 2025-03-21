"use server";

import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import api from "@/lib/api";
import { redirect } from "next/navigation";

export default async function ShareThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const threadId = (await params).threadId;

  const thread = await api.threads.getPublicThread(threadId);
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
      messagesAreBeingFetched={false}
      showCloneThreadButton={isAllowedToCloneThread}
    />
  );
}
