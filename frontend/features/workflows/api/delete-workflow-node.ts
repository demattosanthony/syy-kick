import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workflowId,
      nodeId,
    }: {
      workflowId: string;
      nodeId: string;
    }) => api.workflows.deleteNode(workflowId, nodeId),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });
}
