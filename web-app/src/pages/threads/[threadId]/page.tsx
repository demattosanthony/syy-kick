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
  const isWorkflow = searchParams.get("isWorkflow") === "true";
  const workflowId = searchParams.get("workflowId") || "";
  const threadId = params.threadId;

  // Only fetch the thread if it's not a new thread
  const { data: thread } = useThreadQuery(
    threadId as string,
    isNew || isWorkflow
  );

  const initialMessages =
    isNew || !thread ? [] : mapThreadMessagesToMessages(thread);

  return (
    <ChatThread
      initalMessages={initialMessages}
      thread={thread}
      messagesAreBeingFetched={false}
      isNew={isNew}
      isWorkflow={isWorkflow}
      workflowId={workflowId}
    />
  );
}
