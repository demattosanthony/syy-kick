import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetOrganizationTransferablePermission(
  organizationId: string
) {
  return useQuery({
    queryFn: () => api.organizations.getTransferablePermissions(organizationId),
    queryKey: ["organization-transferable-permissions", organizationId],
  });
}
