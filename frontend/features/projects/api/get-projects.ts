import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

export function useInfiniteProjectsQuery({
  search,
  limit = 10,
  initialData,
}: {
  search?: string;
  limit?: number;
  initialData?: any;
} = {}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["infiniteProjects", search, limit, activeWorkspace?.id],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.projects.listProjects({
        search,
        page: pageParam,
        limit,
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
}: { search?: string; limit?: number } = {}) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["projects", search, activeWorkspace?.id, limit],
    queryFn: async () => {
      const response = await api.projects.listProjects({ search, limit });
      return response.data;
    },
  });
}
