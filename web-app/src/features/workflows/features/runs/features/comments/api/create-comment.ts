import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateCommentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            workflowId,
            runId,
            comment
        }: {
            workflowId: string;
            runId: string;
            comment: string;
        }) => await api.workflows.createRunComment(workflowId, runId, comment),
        onSuccess: (_, { workflowId, runId }) => {
            queryClient.invalidateQueries({ queryKey: ["comments", workflowId, runId] });
        }
    });
}
