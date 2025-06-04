import {
  useThreadMessagesQuery,
  useThreadQuery,
} from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
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

  const {
    data: threadMessages,
    isFetching, // True if fetching, including background and refetch
    isRefetching, // True if refetching (implies already has data and is fetching again)
    status, // 'pending', 'error', 'success'
    // isLoading, // This is (status === 'pending' && isFetching), so 'pending' is more direct
    dataUpdatedAt,
  } = useThreadMessagesQuery(threadId as string);

  // Messages are considered "being fetched" if:
  // 1. The query is in 'pending' state (initial load, no data yet).
  // 2. The query is actively fetching or refetching data (even if it has some stale data).
  const messagesAreBeingFetched =
    status === "pending" || isFetching || isRefetching;

  //   console.log("--- Query State ---");
  //   console.log("status:", status);
  //   console.log("isFetching:", isFetching);
  //   console.log("isRefetching:", isRefetching);
  console.log("messagesAreBeingFetched:", messagesAreBeingFetched);
  //   console.log(
  //     "threadMessages:",
  //     threadMessages ? `(${threadMessages.length} messages)` : undefined
  //   );
  //   console.log(
  //     "dataUpdatedAt:",
  //     dataUpdatedAt ? new Date(dataUpdatedAt) : undefined
  //   );
  //   console.log("--------------------");

  return (
    <ChatThread
      initalMessages={threadMessages || []}
      thread={thread}
      messagesAreBeingFetched={messagesAreBeingFetched}
      isNew={isNew}
    />
  );
}
