import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: (threadId: string) => api.threads.deleteThread(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["threads"],
        predicate: (query) => {
          const [key, workspaceId] = query.queryKey;
          return key === "threads" && workspaceId === activeWorkspace?.id;
        },
      });
    },
  });
}
