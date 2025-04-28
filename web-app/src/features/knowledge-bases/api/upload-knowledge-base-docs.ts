import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export const useUploadKnowledgeBaseFiles = () => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: ({
      knowledgeBaseId,
      files,
      basePath,
    }: {
      knowledgeBaseId: string;
      files: File[];
      basePath?: string;
    }) =>
      api.knowledgeBases.uploadFiles(
        knowledgeBaseId,
        files,
        basePath,
        (progress) => {
          setProgress(progress);
        }
      ),
    onSuccess: (_, { knowledgeBaseId }) => {
      // Invalidate documents for the knowledge base to reflect new uploads
      queryClient.invalidateQueries({
        queryKey: ["knowledge-base-docs", knowledgeBaseId],
      });
      setProgress(0);
    },
    onError: () => {
      setProgress(0);
    },
  });

  return { ...mutation, progress };
};
