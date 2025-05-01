import {
  useMutation,
  useQueryClient,
  UseMutationOptions,
} from "@tanstack/react-query";
import api from "@/lib/api";
import { WorkflowUpdateRequest } from "../workflows.types";

type UpdateWorkflowVariables = {
  workflowId: string;
  data: WorkflowUpdateRequest;
};

type UpdateWorkflowResult = {
  message: string;
  id: string;
};

export function useUpdateWorkflowMutation(
  hookOptions?: UseMutationOptions<
    UpdateWorkflowResult,
    Error,
    UpdateWorkflowVariables
  >
) {
  const queryClient = useQueryClient();

  const mutationFn = async ({
    workflowId,
    data,
  }: UpdateWorkflowVariables): Promise<UpdateWorkflowResult> => {
    return await api.workflows.updateWorkflow(workflowId, data);
  };

  return useMutation<UpdateWorkflowResult, Error, UpdateWorkflowVariables>({
    mutationFn,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow", variables.workflowId],
      });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      hookOptions?.onSuccess?.(data, variables, context);
    },
    ...hookOptions,
  });
}
