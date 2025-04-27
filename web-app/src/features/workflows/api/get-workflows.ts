import { useWorkspace } from "@/workspace-context";
import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Workflow } from "../workflows.types";

export function useWorkflowsQuery(initialData?: Workflow[]) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: ["workflows", activeWorkspace?.id],
    queryFn: () => api.workflows.listWorkflows(),
    refetchOnWindowFocus: false,
    initialData,
  });
}
