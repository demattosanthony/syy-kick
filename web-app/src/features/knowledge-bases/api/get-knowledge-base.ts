import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { KnowledgeBase } from "../types";

export const useKnowledgeBase = (knowledgeBaseId: string) => {
  return useQuery<KnowledgeBase, Error>({
    queryKey: ["knowledge-base", knowledgeBaseId],
    queryFn: () => api.knowledgeBases.getKnowledgeBase(knowledgeBaseId),
    enabled: !!knowledgeBaseId, // Only run if ID is provided
  });
};
