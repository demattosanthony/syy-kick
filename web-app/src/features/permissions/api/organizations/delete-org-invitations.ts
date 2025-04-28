import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function useDeleteOrgInvitationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      invitationsIds,
    }: {
      organizationId: string;
      invitationsIds: string[];
    }) => api.permissions.deleteOrgInvitations(organizationId, invitationsIds),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-invite", organizationId],
      });
    },
  });
}
