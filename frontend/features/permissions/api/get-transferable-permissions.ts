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

export function useGetTransferableOrgProjectsQuery({
  organizationId,
}: {
  organizationId: string;
}) {
  return useQuery({
    queryKey: ["organization-transferable-projects", organizationId],
    queryFn: () => api.permissions.getTransferableOrgProjects(organizationId),
  });
}
