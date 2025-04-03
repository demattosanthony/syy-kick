import { useInfiniteQuery } from "@tanstack/react-query";
import { IssueStatus, PaginatedIssues } from "../issues.types";
import api from "@/lib/api";

export const useGetIssues = (
  projectId: string,
  options?: {
    status?: IssueStatus;
    limit?: number;
  }
) => {
  const limit = options?.limit ?? 10;

  return useInfiniteQuery<PaginatedIssues, Error>({
    queryKey: ["issues", projectId, options?.status],
    queryFn: ({ pageParam = 1 }) =>
      api.issues.listIssues(projectId, {
        ...options,
        page: pageParam as number,
        limit: limit,
      }),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined;
    },
    initialPageParam: 1,
    enabled: !!projectId,
  });
};
