import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useThreadsQuery({
  search,
  pageSize = 10,
}: {
  search?: string;
  pageSize?: number;
} = {}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["threads", search, activeWorkspace?.id, pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.threads.getThreads(
        pageParam,
        pageSize,
        search
      );
      return {
        threads: response.threads,
        nextPage: response.pagination.hasMore ? pageParam + 1 : undefined,
        pagination: response.pagination,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}
