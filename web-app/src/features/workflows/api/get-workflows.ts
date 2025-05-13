import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { GetVNextWorkflowResponse } from "@mastra/client-js";

export function useWorkflowsQuery() {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["workflows", activeWorkspace?.id],
    queryFn: () => api.workflows.listWorkflows(),
    refetchOnWindowFocus: false,
  });
}
