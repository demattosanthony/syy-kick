import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UpdateOrgMemberRoleRequest } from "../../types";

export default function useUpdateOrgMemberRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      memberId,
      data,
    }: {
      organizationId: string;
      memberId: string;
      data: UpdateOrgMemberRoleRequest;
    }) => api.permissions.updateOrgMemberRole(organizationId, memberId, data),
    onSuccess: (_, { organizationId, memberId }) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-member", organizationId, memberId],
      });
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
    },
  });
}
