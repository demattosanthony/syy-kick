import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useThreadQuery(threadId: string, isNewThread: boolean) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["thread", threadId, activeWorkspace?.id],
    queryFn: () => api.threads.getThread(threadId),
    enabled: !isNewThread, // Only fetch if it's not a new thread
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
