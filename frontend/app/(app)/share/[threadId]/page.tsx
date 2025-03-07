"use client";

import { usePublicThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { useMeQuery } from "@/features/user/api";
import { redirect, useParams } from "next/navigation";
import { useMemo } from "react";

export default function ShareThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const { data: thread, isFetched, isLoading } = usePublicThreadQuery(threadId);
  const {data: me} = useMeQuery()

  const initalMessages = useMemo(() => {
    if (!thread) return [];

    return mapThreadMessagesToMessages(thread);
  }, [thread]);

const isAllowedToCloneThread = !thread?.organizationId || !!(
  me?.organizationMembers?.some(
    (member) => member.organization.id === thread?.organizationId
  )
);

  if (isFetched && thread?.isPublic !== true) {
    return redirect("/");
  }

  return (
    <ChatThread
      initalMessages={initalMessages}
      thread={thread}
      viewOnly
      messagesAreBeingFetched={isLoading}
      showCloneThreadButton={isAllowedToCloneThread}
    />
  );
}
