import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useUploadKnowledgeBaseFiles = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      knowledgeBaseId,
      files,
      basePath,
      onProgress,
    }: {
      knowledgeBaseId: string;
      files: File[];
      basePath?: string;
      onProgress?: (progress: number) => void;
    }) =>
      api.knowledgeBases.uploadFiles(
        knowledgeBaseId,
        files,
        basePath,
        onProgress
      ),
    onSuccess: (_, variables) => {
      // Invalidate documents for the knowledge base to reflect new uploads
      queryClient.invalidateQueries({
        queryKey: ["knowledge-base-docs", variables.knowledgeBaseId],
      });
    },
    onError: (error) => {
      console.error("Failed to upload files:", error);
    },
  });
};
