import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function useDeleteOrgMembersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      membersIds,
    }: {
      organizationId: string;
      membersIds: string[];
    }) => api.permissions.deleteOrgMembers(organizationId, membersIds),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
    },
  });
}
