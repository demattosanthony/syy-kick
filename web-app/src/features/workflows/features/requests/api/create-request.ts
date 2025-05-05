import { useMutation } from "@tanstack/react-query";
import { WorkflowRequest } from "../types";
import api from "@/lib/api";

export function useCreateRequestMutation() {
    return useMutation({
        mutationFn: (data: Omit<WorkflowRequest, "requestedBy">) => api.workflows.createRequest(data),
    });
}