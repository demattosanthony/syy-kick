import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrgInvitationsRequest } from "../../types";

export default function useCreateOrgInvitationsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: OrgInvitationsRequest }) =>
      api.permissions.createOrgInvitations(organizationId, data),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-invite", organizationId],
      });
    },
  });
}
