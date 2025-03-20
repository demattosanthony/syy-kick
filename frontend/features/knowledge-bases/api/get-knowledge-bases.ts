import { useQuery } from "@tanstack/react-query";
import { KnowledgeBase } from "../types/knowledge-bases";
import api from "@/lib/api";

export const useKnowledgeBases = () => {
  return useQuery<KnowledgeBase[], Error>({
    queryKey: ["knowledge-bases"],
    queryFn: () => api.knowledgeBases.listKnowledgeBases(),
  });
};
