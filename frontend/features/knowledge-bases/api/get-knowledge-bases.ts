import { useQuery } from "@tanstack/react-query";
import { KnowledgeBase } from "../types/knowledge-bases";
import api from "@/lib/api";

export const useKnowledgeBases = () => {
  return useQuery<KnowledgeBase[], Error>({
    queryKey: ["knowledge-bases"],
    queryFn: () => api.knowledgeBases.listKnowledgeBases(),
  });
};

export const useInfiniteKnowledgeBasesQuery = ({
  search,
  limit,
}: {
  search?: string;
  limit: number;
}) => {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.knowledgeBases, { search, limit }],
    queryFn: async ({ pageParam = 1 }) => {
      // Assuming the API supports pagination; adjust as needed
      const response = await api.knowledgeBases.listKnowledgeBases(); // Add page/limit params if API supports it
      return {
        data: response,
        pagination: {
          page: pageParam,
          limit,
          totalCount: response.length, // Replace with actual total from API
          totalPages: Math.ceil(response.length / limit), // Replace with actual total
          hasMore: response.length === limit, // Replace with actual logic
        },
      };
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.pagination.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
  });
};
