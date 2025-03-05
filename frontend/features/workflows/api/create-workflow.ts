import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCreateWorkflowMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: (name: string) => api.workflows.createWorkflow(name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workflows", activeWorkspace?.id],
      });
    },
  });
}
