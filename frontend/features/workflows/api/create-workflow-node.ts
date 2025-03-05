import api from "@/lib/api";
import { InputNodeConfig, LlmAgentConfig } from "@/types/workflow-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateNodeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workflowId,
      nodeData,
    }: {
      workflowId: string;
      nodeData: {
        type: string;
        positionX: number;
        positionY: number;
        config?: InputNodeConfig | LlmAgentConfig;
      };
    }) => api.workflows.createNode(workflowId, nodeData),
    onSuccess: (_, { workflowId }) => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
    },
  });
}
