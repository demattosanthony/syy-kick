import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useThreadsQuery({
  search,
  projectId,
  knowledgeBaseId,
  workflowId,
}: {
  search?: string;
  projectId?: string;
  knowledgeBaseId?: string;
  workflowId?: string;
} = {}) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: [
      "threads",
      search,
      activeWorkspace?.id,
      projectId,
      knowledgeBaseId,
      workflowId,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const threads = await api.threads.getThreads(
        pageParam,
        search,
        projectId,
        knowledgeBaseId,
        workflowId
      );
      return {
        threads,
        nextPage: threads.length === 10 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
  });
}
