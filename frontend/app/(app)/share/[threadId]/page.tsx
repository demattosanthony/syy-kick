"use server";

import { getPublicThread, me } from "@/app/actions";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { redirect } from "next/navigation";

export default async function ShareThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const threadId = params.threadId;

  const thread = await getPublicThread(threadId);
  const user = await me();

  if (!thread && thread?.isPublic !== true) {
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
