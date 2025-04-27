import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetRoles() {
  return useQuery({
    queryFn: () => api.permissions.getRoles(),
    queryKey: ["permissions-roles"],
  });
}
