import { WorkflowsList } from "@/features/workflows/components";
import { useParams } from "react-router";

export function ProjectWorkflowsPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();

  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 w-full">
      <WorkflowsList projectId={projectId ?? ""} />
    </div>
  );
}
