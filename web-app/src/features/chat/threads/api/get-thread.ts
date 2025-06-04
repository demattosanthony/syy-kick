import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useThreadQuery(threadId: string) {
  return useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.threads.getThread(threadId),
    refetchOnWindowFocus: false,
  });
}

export function usePublicThreadQuery(threadId: string) {
  return useQuery({
    queryKey: ["public-thread", threadId],
    queryFn: () => api.threads.getPublicThread(threadId),
    refetchOnWindowFocus: false,
  });
}
