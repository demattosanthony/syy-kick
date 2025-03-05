import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteWorkflowMutation() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: (workflowId: string) =>
      api.workflows.deleteWorkflow(workflowId),
    onSuccess: () => {
      // Fix: Use predicate to match the exact query key structure
      queryClient.invalidateQueries({
        queryKey: ["workflows"],
        predicate: (query) => {
          const [key, workspaceId] = query.queryKey;
          return key === "workflows" && workspaceId === activeWorkspace?.id;
        },
      });
    },
  });
}
