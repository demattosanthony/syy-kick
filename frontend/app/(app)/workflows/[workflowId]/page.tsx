import { WorkflowPageContent } from "@/features/workflows/components";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;

  return <WorkflowPageContent workflowId={workflowId} />;
}
