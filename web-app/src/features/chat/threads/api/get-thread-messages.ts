import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export function useThreadMessagesQuery(threadId: string) {
  return useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: () => api.threads.getThreadMessages(threadId),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}
