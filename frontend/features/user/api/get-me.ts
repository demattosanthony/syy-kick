import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useMeQuery() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.auth.me(),
    refetchOnWindowFocus: false,
  });
}
