import { WorkflowRunRequest } from "@/features/workflows/workflows.types";
import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export function useCreateRunMutation() {
    return useMutation({
        mutationFn: async (run: WorkflowRunRequest) => await api.workflows.createRun(run)
    })
}