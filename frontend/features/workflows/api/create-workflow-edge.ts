import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateEdgeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workflowId,
      edgeData,
    }: {
      workflowId: string;
      edgeData: {
        sourceNodeId: string;
        targetNodeId: string;
      };
    }) => api.workflows.createEdge(workflowId, edgeData),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });
}
