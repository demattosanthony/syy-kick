"use server";

import { WorkflowPageContent } from "@/features/workflows/components";
import api from "@/lib/api";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;
  const workflow = await api.workflows
    .getWorkflow(workflowId)
    .catch(() => undefined);

  return <WorkflowPageContent workflowId={workflowId} workflow={workflow} />;
}
