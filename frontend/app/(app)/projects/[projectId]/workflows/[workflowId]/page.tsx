"use client";

import { useWorkflowQuery } from "@/features/workflows/api";
import { WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "next/navigation";

export default function WorkflowPage() {
  const { projectId, workflowId } = useParams<{
    projectId: string;
    workflowId: string;
  }>();

  const { data: workflow } = useWorkflowQuery(workflowId);

  return (
    <div className="flex flex-col flex-1 pt-4">
      <WorkflowPageContent
        projectId={projectId}
        workflowId={workflowId}
        workflow={workflow}
      />
    </div>
  );
}
