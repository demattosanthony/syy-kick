import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteOrganizationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.organizations.deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
