import { useQuery } from "@tanstack/react-query";
import { KnowledgeBase } from "../types/knowledge-bases";
import api from "@/lib/api";

export const useKnowledgeBase = (knowledgeBaseId: string) => {
  return useQuery<KnowledgeBase, Error>({
    queryKey: ["knowledge-base", knowledgeBaseId],
    queryFn: () => api.knowledgeBases.getKnowledgeBase(knowledgeBaseId),
    enabled: !!knowledgeBaseId, // Only run if ID is provided
  });
};
