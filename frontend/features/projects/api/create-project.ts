import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      organizationId?: string;
      siteId?: string;
      name: string;
      description: string;
      location_name?: string;
      place_id?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      latitude?: number;
      longitude?: number;
      project_number?: string;
      estimated_start_date?: string;
      estimated_end_date?: string;
    }) =>
      api.projects.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
