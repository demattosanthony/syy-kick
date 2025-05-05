import api from "@/lib/api"
import { useMutation } from "@tanstack/react-query"

export const useTriggerRunMutation = () => {
    return useMutation({
        mutationFn: async ({
            workflowId,
            workflowRunId
        }: {
            workflowId: string;
            workflowRunId: string;
        }) => await api.workflows.triggerRun(workflowId, workflowRunId)
    })
}