import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useCreateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      visibility?: "private" | "public";
    }) => api.knowledgeBases.createKnowledgeBase(data),
    onSuccess: (newKnowledgeBase) => {
      // Invalidate and refetch the list of knowledge bases
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      // Optionally, set the new knowledge base in cache immediately
      queryClient.setQueryData(
        ["knowledge-base", newKnowledgeBase.id],
        newKnowledgeBase
      );
    },
    onError: (error) => {
      console.error("Failed to create knowledge base:", error);
    },
  });
};
