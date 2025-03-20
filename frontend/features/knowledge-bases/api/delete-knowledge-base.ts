import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (knowledgeBaseId: string) =>
      api.knowledgeBases.deleteKnowledgeBase(knowledgeBaseId),
    onSuccess: (_, knowledgeBaseId) => {
      // Remove the deleted knowledge base from cache
      queryClient.removeQueries({
        queryKey: ["knowledge-base", knowledgeBaseId],
      });
      // Invalidate the list
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    },
    onError: (error) => {
      console.error("Failed to delete knowledge base:", error);
    },
  });
};
