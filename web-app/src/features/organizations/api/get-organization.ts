import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useOrgQuery(orgId: string) {
  return useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api.organizations.getOrg(orgId),
    refetchOnWindowFocus: false,
  });
}

export function useOrgFromInviteToken(token: string) {
  return useQuery({
    queryKey: ["organization-from-invite", token],
    queryFn: () => api.organizations.getOrgFromInviteToken(token),
  });
}