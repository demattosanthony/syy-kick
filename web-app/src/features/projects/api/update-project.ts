import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        siteId?: string;
        organizationId?: string;
        name?: string;
        description?: string;
        project_number?: string;
        estimated_start_date?: string;
        estimated_end_date?: string;
        address?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        postalCode?: string | null;
        latitude?: number;
        longitude?: number;
        placeId?: string | null;
      };
    }) => api.projects.updateProject(projectId, data),
    onSuccess: (_, { projectId }) => {
      // Invalidate the specific project query
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      // Invalidate the projects list
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
