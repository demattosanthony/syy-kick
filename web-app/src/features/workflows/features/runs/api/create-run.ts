import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export function useCreateRunMutation() {
    return useMutation({
        mutationFn: async ({
            workflowId,
            input
        }: {
            workflowId: string;
            input: any;
        }) => await api.workflows.createRun(workflowId, input)
    })
}