import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      knowledgeBaseId,
      data,
    }: {
      knowledgeBaseId: string;
      data: {
        name?: string;
        description?: string;
        visibility?: "private" | "public";
      };
    }) => api.knowledgeBases.updateKnowledgeBase(knowledgeBaseId, data),
    onSuccess: (updatedKnowledgeBase) => {
      // Update the specific knowledge base in cache
      queryClient.setQueryData(
        ["knowledge-base", updatedKnowledgeBase.id],
        updatedKnowledgeBase
      );
      // Invalidate the list to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    },
    onError: (error) => {
      console.error("Failed to update knowledge base:", error);
    },
  });
};
