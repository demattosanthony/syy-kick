import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateCommentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            workflowId,
            runId,
            commentId,
            comment
        }: {
            workflowId: string;
            runId: string;
            commentId: string;
            comment: string;
        }) => await api.workflows.updateRunComment(workflowId, runId, commentId, comment),
        onSuccess: (_, { workflowId, runId }) => {
            queryClient.invalidateQueries({ queryKey: ["comments", workflowId, runId] });
        }
    });
}
