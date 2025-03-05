import api from "@/lib/api";
import { InputNodeConfig, LlmAgentConfig } from "@/types/workflow-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workflowId,
      nodeId,
      nodeData,
    }: {
      workflowId: string;
      nodeId: string;
      nodeData: Partial<{
        type: string;
        positionX: number;
        positionY: number;
        config: InputNodeConfig | LlmAgentConfig;
      }>;
    }) => api.workflows.updateNode(workflowId, nodeId, nodeData),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });
}
