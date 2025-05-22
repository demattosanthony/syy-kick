import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useGetCommentsQuery(workflowId: string, runId: string) {
    return useQuery({
        queryKey: ["comments", workflowId, runId],
        queryFn: () => api.workflows.getRunComments(workflowId, runId),
        enabled: !!workflowId && !!runId,
    });
}
