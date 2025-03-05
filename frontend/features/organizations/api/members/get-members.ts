import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useOrganizationMembersQuery(organizationId: string) {
  return useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: () => api.organizations.listOrganizationMembers(organizationId),
  });
}
