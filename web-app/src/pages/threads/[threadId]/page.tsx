import { useThreadQuery } from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { mapThreadMessagesToMessages } from "@/features/chat/threads/utils";
import { useParams, useSearchParams } from "react-router";

export function ThreadPage() {
  const params = useParams<{
    threadId: string;
  }>();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("isNew") === "true";
  const threadId = params.threadId;

  // Only fetch the thread if it's not a new thread
  const { data: thread } = useThreadQuery(threadId as string, isNew);

  const initialMessages =
    isNew || !thread ? [] : mapThreadMessagesToMessages(thread);

  return (
    <ChatThread
      initalMessages={initialMessages}
      thread={thread}
      messagesAreBeingFetched={false}
      isNew={isNew}
    />
  );
}
