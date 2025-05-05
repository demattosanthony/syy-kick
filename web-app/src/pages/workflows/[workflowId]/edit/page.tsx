import { useParams, useNavigate } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api/get-workflow";
import WorkflowForm from "@/features/workflows/components/workflow-builder/workflow-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function EditWorkflowPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();

  if (!workflowId) {
    // Should ideally not happen if routing is correct, but good practice
    return <div>Error: Workflow ID is missing.</div>;
  }

  const {
    data: workflow,
    isLoading,
    isError,
    error,
  } = useWorkflowQuery(workflowId);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full border rounded-lg p-4" />
          <Skeleton className="h-24 w-full border-dashed border-2" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (isError) {
      return (
        <Alert variant="destructive" className="max-w-2xl mx-auto">
          <AlertTitle>Error Loading Workflow</AlertTitle>
          <AlertDescription>
            {error?.message || "An unknown error occurred."} Please try again.
          </AlertDescription>
        </Alert>
      );
    }

    if (workflow) {
      return <WorkflowForm initialData={workflow} />;
    }

    return null; // Should not happen if no error and not loading
  };

  return (
    <div>
      <div className="mx-auto px-4 py-4 flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => navigate(`/workflows/${workflowId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Workflow
        </Button>
        {/* Can add other actions here if needed */}
      </div>
      {renderContent()}
    </div>
  );
}
