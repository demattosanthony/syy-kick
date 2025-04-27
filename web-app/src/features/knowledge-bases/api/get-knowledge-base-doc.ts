import api from "@/lib/api";
import { DocumentContent } from "@/types/project";
import { useQuery } from "@tanstack/react-query";

export const useKnowledgeBaseDocument = (
  knowledgeBaseId: string,
  path: string
) => {
  return useQuery<DocumentContent, Error>({
    queryKey: ["knowledge-base-document", knowledgeBaseId, path],
    queryFn: () => api.knowledgeBases.getDocument(knowledgeBaseId, path),
    enabled: !!knowledgeBaseId && !!path, // Only run if both ID and path are provided
    retry: 1, // Limit retries for missing files
  });
};
