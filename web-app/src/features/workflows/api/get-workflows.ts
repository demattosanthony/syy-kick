import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export function useWorkflowsQuery(query?: string) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["workflows", activeWorkspace?.id, query],
    queryFn: () => api.workflows.listWorkflows(query),
    refetchOnWindowFocus: false,
  });
}
