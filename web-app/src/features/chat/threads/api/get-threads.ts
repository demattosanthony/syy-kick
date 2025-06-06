import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useThreadsQuery({
  search,
  workflowId,
  pageSize,
}: {
  search?: string;
  workflowId?: string;
  pageSize?: number;
} = {}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["threads", search, activeWorkspace?.id, workflowId, pageSize],
    queryFn: async ({ pageParam = 1 }) => {
      const threads = await api.threads.getThreads(
        pageParam,
        pageSize,
        search,
        workflowId
      );
      return {
        threads,
        nextPage: threads.length === pageSize ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}
