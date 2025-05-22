import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteCommentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            workflowId,
            runId,
            commentId
        }: {
            workflowId: string;
            runId: string;
            commentId: string;
        }) => await api.workflows.deleteRunComment(workflowId, runId, commentId),
        onSuccess: (_, { workflowId, runId }) => {
            queryClient.invalidateQueries({ queryKey: ["comments", workflowId, runId] });
        }
    });
} 