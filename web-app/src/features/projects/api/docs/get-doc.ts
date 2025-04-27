import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useProjectDocQuery(projectId: string, path: string) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["project-doc", projectId, path, activeWorkspace?.id],
    queryFn: () => api.projects.getDocument(projectId, path),
    refetchOnWindowFocus: false,
  });
}
