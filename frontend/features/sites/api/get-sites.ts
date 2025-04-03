import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";

export default function useInfiniteGetSitesQuery({
  search,
  limit = 10,
}: {
  search?: string;
  limit?: number;
}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["infiniteSites", search, limit, activeWorkspace?.id],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await api.sites.listSites({
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
  });
}
