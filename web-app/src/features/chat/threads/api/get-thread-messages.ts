import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export function useThreadMessagesQuery(threadId: string) {
  return useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => api.threads.getThreadMessages(threadId),
  });
}

export function usePublicThreadMessagesQuery(threadId: string) {
  return useQuery({
    queryKey: ["public-thread-messages", threadId],
    queryFn: () => api.threads.getPublicThreadMessages(threadId),
  });
}
