import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      latitude?: string;
      longitude?: string;
      project_number?: string;
      estimated_start_date?: string;
      estimated_end_date?: string;
    }) =>
      api.projects.createProject({
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
