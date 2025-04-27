import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetOrganizationRole(organizationId: string) {
  return useQuery({
    queryFn: () => api.organizations.getUserRole(organizationId),
    queryKey: ["organization-role", organizationId],
  });
}

// export function useGetProjectRole(projectId: string) {
//   return useQuery({
//     queryFn: () => api.projects.getRole(projectId),
//     queryKey: ["project-role", projectId],
//   });
// }
