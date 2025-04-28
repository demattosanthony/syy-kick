import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function useGetOrgInvitationsQuery(organizationId: string) {
  return useQuery({
    queryFn: () => api.permissions.getOrgInvitations(organizationId),
    queryKey: ["organization-invite", organizationId],
  });
}
