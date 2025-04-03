"use client";

import { useWorkflowQuery } from "@/features/workflows/api";
import { WorkflowPageContent } from "@/features/workflows/components";
import { useParams } from "next/navigation";

export default function WorkflowPage() {
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow } = useWorkflowQuery(workflowId);

  return <WorkflowPageContent workflowId={workflowId} workflow={workflow} />;
}
