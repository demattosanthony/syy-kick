import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { Project } from "@/types/project";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SortOption } from "../types";

export function useInfiniteProjectsQuery({
  siteId,
  search,
  limit = 10,
  initialData,
  sort,
}: {
  siteId?: string;
  search?: string;
  limit?: number;
  initialData?: {
    pages: {
      data: Project[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
        hasMore: boolean;
      };
    }[];
    pageParams: number[];
  };
  sort?: SortOption;
} = {}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["infiniteProjects", siteId, search, limit, activeWorkspace?.id, sort],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.projects.listProjects({
        siteId,
        search,
        page: pageParam,
        limit,
        sort,
      });
      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialData: initialData,
  });
}

// Keep the original query for backward compatibility
export function useProjectsQuery({
  search,
  limit,
  sort,
}: { search?: string; limit?: number; sort?: SortOption } = {}) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["projects", search, activeWorkspace?.id, limit, sort],
    queryFn: async () => {
      const response = await api.projects.listProjects({ search, limit, sort });
      return response.data;
    },
  });
}
