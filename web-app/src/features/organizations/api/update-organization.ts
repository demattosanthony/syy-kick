import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        domain: string;
        logo: string;
      }>;
    }) => api.organizations.updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
