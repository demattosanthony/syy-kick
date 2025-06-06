import {
  useThreadMessagesQuery,
  useThreadQuery,
} from "@/features/chat/threads/api";
import { ChatThread } from "@/features/chat/threads/components";
import { useParams } from "react-router";
import { useAtom } from "jotai";
import {
  pendingThreadAtom,
  isPendingThreadAtom,
  chatStatusAtom,
} from "@/atoms/chat";
import { ChatMessage, MessageRole } from "@/types/chat";
import { useEffect, useState, useMemo } from "react";

export function ThreadPage() {
  const { threadId } = useParams<{
    threadId: string;
  }>();

  const [pendingThread, setPendingThread] = useAtom(pendingThreadAtom);
  const [, setIsPendingThread] = useAtom(isPendingThreadAtom);
  const [, setChatStatus] = useAtom(chatStatusAtom);

  const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([]);

  // Check if this is a pending thread
  const isPendingThreadId = threadId?.startsWith("pending-");
  const isTransitioning =
    !isPendingThreadId && pendingThread?.actualThreadId === threadId;

  // For regular threads, use existing queries
  const queryThreadId = isPendingThreadId ? "" : (threadId as string);
  const { data: thread } = useThreadQuery(queryThreadId, {
    enabled: queryThreadId !== "",
  });

  const {
    data: threadMessages,
    isFetching,
    isRefetching,
  } = useThreadMessagesQuery(queryThreadId, {
    enabled: queryThreadId !== "",
  });

  const optimisticMessage = useMemo((): ChatMessage | null => {
    if (isPendingThreadId && pendingThread) {
      return {
        id: `${pendingThread.tempId}-user-message`,
        role: MessageRole.user,
        text: pendingThread.initialMessage,
        createdAt: new Date().toISOString(),
        attachments: pendingThread.uploads.map((upload, index) => ({
          id: `${pendingThread.tempId}-attachment-${index}`,
          messageId: `${pendingThread.tempId}-user-message`,
          type: upload.type === "image" ? "image" : "file",
          fileKey: "pending", // Placeholder
          url: upload.preview,
          fileName: upload.file.name,
          mimeType: upload.file.type,
          size: upload.file.size,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      };
    }
    return null;
  }, [isPendingThreadId, pendingThread]);

  // Effect to manage the lifecycle of displayedMessages
  useEffect(() => {
    // 1. Initialize with optimistic message
    if (optimisticMessage && displayedMessages.length === 0) {
      setDisplayedMessages([optimisticMessage]);
      setChatStatus("submitted");
    }

    // 2. Transition from optimistic to real messages
    if (isTransitioning && threadMessages && threadMessages.length > 0) {
      setDisplayedMessages(threadMessages);
      // 3. Clean up pending state after transition is complete
      const timer = setTimeout(() => {
        setPendingThread(null);
        setIsPendingThread(false);
        setChatStatus("ready");
      }, 100);
      return () => clearTimeout(timer);
    }

    // 4. Handle direct load of a normal thread
    if (!isPendingThreadId && !isTransitioning && threadMessages) {
      setDisplayedMessages(threadMessages);
    }
  }, [
    optimisticMessage,
    threadMessages,
    isTransitioning,
    isPendingThreadId,
    setPendingThread,
    setIsPendingThread,
    setChatStatus,
    displayedMessages.length,
  ]);

  const displayThread = useMemo(() => {
    if ((isPendingThreadId || isTransitioning) && pendingThread) {
      return {
        id: threadId!,
        title:
          pendingThread.initialMessage.slice(0, 50) +
          (pendingThread.initialMessage.length > 50 ? "..." : ""),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return thread;
  }, [isPendingThreadId, isTransitioning, pendingThread, threadId, thread]);

  const messagesAreBeingFetched =
    (isFetching || isRefetching) && !isTransitioning;

  //   const isProcessingPending =
  //     isPendingThreadId && pendingThread?.status === "processing";

  return (
    <ChatThread
      initalMessages={displayedMessages}
      thread={displayThread}
      messagesAreBeingFetched={messagesAreBeingFetched}
      viewOnly={false}
    />
  );
}
