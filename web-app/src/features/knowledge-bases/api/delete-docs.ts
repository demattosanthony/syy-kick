import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteKnowledgeBaseContentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ kbId, path }: { kbId: string; path: string }) =>
      api.knowledgeBases.deleteDocs(kbId, path),
    onSuccess: (_, { kbId }) => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-base-docs", kbId],
      });
    },
  });
}
