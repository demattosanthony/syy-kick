import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import api from "@/lib/api";
import { redirect } from "react-router";
import { useParams } from "react-router";

export async function ShareThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();

  const thread = await api.threads
    .getPublicThread(threadId as string)
    .catch(() => null);
  const user = await api.auth.me();

  if (!thread || thread.isPublic !== true) {
    redirect("/");
  }

  const initialMessages = thread ? mapThreadMessagesToMessages(thread) : [];

  const isAllowedToCloneThread =
    !thread?.organizationId ||
    !!user?.organizations?.some((org) => org.id === thread.organizationId);

  if (!thread) {
    return <></>;
  }

  return (
    <ChatThread
      initalMessages={initialMessages}
      thread={thread}
      viewOnly
      showCloneThreadButton={isAllowedToCloneThread}
    />
  );
}
