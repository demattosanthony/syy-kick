import WorkflowPageContent from "@/components/workflows/workflow-page-content";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId } = await params;

  return <WorkflowPageContent workflowId={workflowId} />;
}
