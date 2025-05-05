import { useMutation } from "@tanstack/react-query";
import { Step } from "../workflows.types";
import api from "@/lib/api";

export function useCreateWorkflowMutation() {
    return useMutation({
        mutationFn: (data: {
            name: string;
            description: string;
            workflowSteps: Step[];
        }) => api.workflows.createWorkflow(data),
    });
};