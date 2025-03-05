import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to update an organization member's role
 */
export function useUpdateOrganizationMemberRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      role,
    }: {
      organizationId: string;
      userId: string;
      role: "owner" | "member";
    }) => {
      return await api.organizations.updateMemberRole(
        organizationId,
        userId,
        role
      );
    },
    onSuccess: (_, { organizationId }) => {
      // Invalidate the org-member list so the UI refreshes
      queryClient.invalidateQueries({
        queryKey: ["organization-members", organizationId],
      });
    },
  });
}
