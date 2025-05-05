import api from "@/lib/api";
import { useMutation } from "@tanstack/react-query";

export function useDeleteWorkflowMutation() {
  return useMutation({
    mutationFn: (workflowId: string) =>
      api.workflows.deleteWorkflow(workflowId),
  });
}
