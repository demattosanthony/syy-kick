import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.projects.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
