import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useProjectMembersQuery(projectId: string) {
  return useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api.projects.getProjectMembers(projectId),
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });
}
