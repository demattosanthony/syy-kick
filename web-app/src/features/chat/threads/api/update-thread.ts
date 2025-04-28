import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { UpdateThreadMutationData } from "@/types/chat";

export function useUpdateThreadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      data,
    }: {
      threadId: string;
      data: UpdateThreadMutationData;
    }) => api.threads.updateThread(threadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["threads"],
      });
    },
  });
}
