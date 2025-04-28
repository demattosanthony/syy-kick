import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useResetOrganizationInviteTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.organizations.resetOrganizationInviteToken(organizationId),
    onSuccess: (_, organizationId) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-invite", organizationId],
      });
    },
  });
}
