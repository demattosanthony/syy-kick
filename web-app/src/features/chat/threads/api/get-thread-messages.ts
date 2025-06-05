import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ChatMessage } from "@/types/chat";

type UseThreadMessagesQueryOptions = Omit<
  UseQueryOptions<ChatMessage[], Error>,
  "queryKey" | "queryFn"
>;

export function useThreadMessagesQuery(
  threadId: string,
  options?: UseThreadMessagesQueryOptions
) {
  return useQuery<ChatMessage[], Error>({
    queryKey: ["thread-messages", threadId],
    queryFn: () => api.threads.getThreadMessages(threadId),
    ...options,
  });
}

export function usePublicThreadMessagesQuery(threadId: string) {
  return useQuery({
    queryKey: ["public-thread-messages", threadId],
    queryFn: () => api.threads.getPublicThreadMessages(threadId),
  });
}
