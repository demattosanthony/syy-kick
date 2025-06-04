import {
  useThreadMessagesQuery,
  useThreadQuery,
} from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { useParams } from "react-router";

export function ThreadPage() {
  const { threadId } = useParams<{
    threadId: string;
  }>();

  const { data: thread } = useThreadQuery(threadId as string);

  const {
    data: threadMessages,
    isFetching,
    isRefetching,
    status,
  } = useThreadMessagesQuery(threadId as string);

  const messagesAreBeingFetched =
    status === "pending" || isFetching || isRefetching;

  console.log("threadMessages:", threadMessages);

  return (
    <ChatThread
      initalMessages={threadMessages || []}
      thread={thread}
      messagesAreBeingFetched={messagesAreBeingFetched}
    />
  );
}
