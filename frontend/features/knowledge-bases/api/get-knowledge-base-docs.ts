import api from "@/lib/api";
import { DocumentContent } from "@/types/project";
import { useQuery } from "@tanstack/react-query";

export const useKnowledgeBaseDocuments = (
  knowledgeBaseId: string,
  path?: string
) => {
  return useQuery<DocumentContent[], Error>({
    queryKey: ["knowledge-base-docs", knowledgeBaseId, path],
    queryFn: () => api.knowledgeBases.getDocuments(knowledgeBaseId, path),
    enabled: !!knowledgeBaseId, // Only run if ID is provided
  });
};
