import { usePublicThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { useMeQuery } from "@/features/user/api";
import { redirect } from "react-router";
import { useParams } from "react-router";

export function ShareThreadPage() {
  const { threadId } = useParams<{ threadId: string }>();

  const { data: thread } = usePublicThreadQuery(threadId as string);
  const { data: user } = useMeQuery();

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
    <div className="flex flex-col h-screen relative">
      <ChatThread
        initalMessages={initialMessages}
        thread={thread}
        viewOnly
        showCloneThreadButton={isAllowedToCloneThread}
      />
    </div>
  );
}
