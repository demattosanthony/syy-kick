import { useWorkspace } from "@/components/sidebar/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useWorkflowQuery(workflowId: string) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["workflow", workflowId, activeWorkspace?.id],
    queryFn: () => api.workflows.getWorkflow(workflowId),
    enabled: !!workflowId,
    refetchOnWindowFocus: false,
  });
}
