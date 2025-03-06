import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useRemoveOrganizationMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
    }: {
      organizationId: string;
      userId: string;
    }) => api.organizations.removeOrganizationMember(organizationId, userId),
    onSuccess: (_, { organizationId }) => {
      // Invalidate org members list
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
      // Invalidate org details
      queryClient.invalidateQueries({
        queryKey: ["organization", organizationId],
      });
    },
  });
}