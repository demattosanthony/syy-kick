import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteWorkflowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      api.workflows.deleteWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });
}
