import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetRunsQuery(workflowId: string) {
  return useQuery({
    queryKey: ["runs", workflowId],
    queryFn: () => api.workflows.getRuns(workflowId),
  });
}
