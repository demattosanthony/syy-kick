import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { KnowledgeBase } from "../types/knowledge-bases";
import api from "@/lib/api";

export const useKnowledgeBases = (page: number = 1, pageSize: number = 10) => {
  return useQuery<
    {
      data: KnowledgeBase[];
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasMore: boolean;
      };
    },
    Error
  >({
    queryKey: ["knowledge-bases", { page, pageSize }],
    queryFn: () => api.knowledgeBases.listKnowledgeBases(page, pageSize),
  });
};

export const useInfiniteKnowledgeBasesQuery = ({
  search,
  limit = 10,
}: {
  search?: string;
  limit?: number;
}) => {
  return useInfiniteQuery({
    queryKey: ["knowledge-bases", { search }],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.knowledgeBases.listKnowledgeBases(
        pageParam,
        limit,
        search
      );
      return {
        data: response.data,
        pagination: response.pagination,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
};
