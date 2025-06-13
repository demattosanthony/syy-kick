import {
  usePublicThreadMessagesQuery,
  usePublicThreadQuery,
} from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
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

  const { data: threadMessages } = usePublicThreadMessagesQuery(
    threadId as string
  );

  const isAllowedToCloneThread =
    !thread?.organizationId ||
    !!user?.organizations?.some((org) => org.id === thread.organizationId);

  if (!thread) {
    return <></>;
  }

  return (
    <div className="flex flex-col h-screen relative">
      <ChatThread
        initalMessages={threadMessages || []}
        thread={thread}
        viewOnly
        showCloneThreadButton={isAllowedToCloneThread}
      />
    </div>
  );
}
