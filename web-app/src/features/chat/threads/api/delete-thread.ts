import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteThreadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => api.threads.deleteThread(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["threads"],
      });
    },
  });
}
