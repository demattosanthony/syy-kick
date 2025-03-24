import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { Thread } from "@/types/chat";
import { useInfiniteQuery } from "@tanstack/react-query";

export function useThreadsQuery(
  search?: string,
  projectId?: string,
  initalThreads?: Thread[]
) {
  const { activeWorkspace } = useWorkspace();

  return useInfiniteQuery({
    queryKey: ["threads", search, activeWorkspace?.id, projectId],
    queryFn: async ({ pageParam = 1 }) => {
      const threads = await api.threads.getThreads(
        pageParam,
        search,
        projectId
      );
      return {
        threads,
        nextPage: threads.length === 10 ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    initialData: {
      pages: [
        initalThreads
          ? { threads: initalThreads, nextPage: undefined }
          : { threads: [], nextPage: undefined },
      ],
      pageParams: [1],
    },
  });
}
