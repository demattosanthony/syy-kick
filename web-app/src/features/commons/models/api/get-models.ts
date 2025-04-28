import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useModelsQuery() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api.models.getAvailableModels(),
  });
}
