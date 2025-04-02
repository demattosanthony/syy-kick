"use client";

import { useWorkflowQuery } from "@/features/workflows/api";
import { WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "next/navigation";

export default function WorkflowPage() {
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return <WorkflowPageContent workflowId={workflowId} workflow={workflow} />;
}
