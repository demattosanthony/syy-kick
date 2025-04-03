import { useInfiniteQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { KnowledgeBase } from "../types/knowledge-bases";

export const useInfiniteKnowledgeBasesQuery = ({
  search,
  limit = 10,
  initalData,
}: {
  search?: string;
  limit?: number;
  initalData?: {
    pages: {
      data: KnowledgeBase[];
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasMore: boolean;
      };
    }[];
    pageParams: number[];
  };
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
    initialData: initalData,
  });
};
