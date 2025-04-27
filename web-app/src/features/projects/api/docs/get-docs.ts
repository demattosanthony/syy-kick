import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useProjectDocsQuery(projectId: string, path?: string) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["project-docs", projectId, path, activeWorkspace?.id],
    queryFn: () => api.projects.getDocuments(projectId, path),
    enabled: !!projectId,
    // Refetch every 15 seconds while the query is active, if any of the docs are processing
    refetchInterval: (query) =>
      query.state.data?.some(
        (doc) =>
          doc.processingJob?.status === "processing" ||
          doc.processingJob?.status === "pending"
      )
        ? 15000
        : false,
    // Stop refetching when the window/tab is not focused
    refetchIntervalInBackground: false,
  });
}
