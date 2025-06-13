import api from "@/lib/api";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface UseFilesOptions {
  search?: string;
  type?: "file" | "folder";
  category?: "drawing" | "document";
  file_origin_type?: "syyclops" | "sharepoint" | "google_drive";
  limit?: number;
}

export function useFiles(options: UseFilesOptions = {}) {
  return useInfiniteQuery({
    queryKey: ["files", options],
    queryFn: async ({ pageParam = 1 }) => {
      return api.files.getFiles({
        ...options,
        page: pageParam,
        limit: options.limit || 20,
      });
    },
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage;
      return pagination.hasNext ? pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

// Helper hook to get flattened files array and utilities
export function useFilesData(options: UseFilesOptions = {}) {
  const query = useFiles(options);

  const files = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.files) || [];
  }, [query.data]);

  const totalFiles = query.data?.pages[0]?.pagination.total || 0;
  const hasMore = query.hasNextPage;

  return {
    ...query,
    files,
    totalFiles,
    hasMore,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}
