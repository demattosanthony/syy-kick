import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useProjectQuery(projectId: string) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["project", projectId, activeWorkspace?.id],
    queryFn: () => api.projects.getProject(projectId),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });
}
