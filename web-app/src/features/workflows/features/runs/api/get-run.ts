import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetRunQuery(workflowId: string, runId: string) {
    return useQuery({
        queryKey: ["runs", workflowId, runId],
        queryFn: () => api.workflows.getRun(workflowId, runId),
    });
}

