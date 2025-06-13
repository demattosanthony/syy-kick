import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetIntegrationsQuery() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: () => api.integrations.getTokens(),
  });
}
