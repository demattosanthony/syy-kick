import api from "@/lib/api";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import type { Thread } from "@/types/chat";

type UseThreadQueryOptions = Omit<
  UseQueryOptions<Thread, Error>,
  "queryKey" | "queryFn"
>;

export function useThreadQuery(
  threadId: string,
  options?: UseThreadQueryOptions
) {
  return useQuery<Thread, Error>({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.getThread(threadId),
    refetchOnWindowFocus: false,
    ...options,
  });
}

export function usePublicThreadQuery(threadId: string) {
  return useQuery({
    queryKey: ["public-thread", threadId],
    queryFn: () => api.threads.getPublicThread(threadId),
    refetchOnWindowFocus: false,
  });
}
