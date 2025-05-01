import { useParams } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Slash, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRunSSE } from "@/features/workflows/features/runs/hooks";
import { useGetRunQuery } from "@/features/workflows/features/runs/api/get-run";
import { WorkflowRunInputs } from "@/features/workflows/features/runs/components/workflow-run-inputs";
import { WorkflowStepCard } from "@/features/workflows/features/runs/components/workflow-step-card";
import { WorkflowStepOutputs } from "@/features/workflows/features/runs/components/workflow-step-outputs";

export function WorkflowRunPageDetails() {
  const { workflowId, runId } = useParams<{
    workflowId: string;
    runId: string;
  }>();

  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflowQuery(
    workflowId as string
  );

  const { data: run, isLoading: isRunLoading } = useGetRunQuery(
    workflowId as string,
    runId as string
  );

  useRunSSE({
    workflowId: workflowId as string,
    workflowRunId: runId as string,
  });

  const calculateDuration = (start: string, end: string, status: string) => {
    if (status !== "completed" && status !== "failed") return null;
    const durationMs = new Date(end).getTime() - new Date(start).getTime();
    const durationSec = durationMs / 1000;
    if (durationSec < 60) {
      return `${durationSec.toFixed(1)}s`;
    } else {
      return `${Math.floor(durationSec / 60)}m ${Math.round(
        durationSec % 60
      )}s`;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col">
      <div className="flex-1 w-full">
        <div className="mx-auto px-4 py-4  w-full">
          <Breadcrumb className="mb-8">
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  to="/workflows"
                  className="hover:text-blue-500 hover:underline"
                >
                  Workflows
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <Link
                  to={`/workflows/${workflowId}`}
                  className="hover:text-blue-500 hover:underline"
                >
                  {isWorkflowLoading ? (
                    <Skeleton className="h-4 w-24" />
                  ) : (
                    workflow?.name
                  )}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <Link
                  to={`/workflows/${workflowId}/runs`}
                  className="hover:text-blue-500 hover:underline"
                >
                  Runs
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator>
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <span className="font-bold">Run #{runId?.slice(0, 8)}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto w-full">
            <h1 className="text-3xl font-bold">Run Details</h1>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Runs
            </Button>
          </div>

          <div className="flex flex-col items-center w-full gap-8 py-8">
            {isRunLoading ? (
              <Skeleton className="h-40 w-full max-w-lg" />
            ) : run?.executionInputValues &&
              Object.keys(run.executionInputValues).length > 0 ? (
              <>
                <div className="text-center text-sm font-medium text-muted-foreground">
                  Input
                  {Object.keys(run.executionInputValues).length > 1 ? "s" : ""}
                </div>
                <div className="max-w-lg w-full">
                  <WorkflowRunInputs inputs={run.executionInputValues} />
                </div>
                <div className="w-px h-8 bg-border"></div>
              </>
            ) : null}

            {isRunLoading ? (
              <>
                <Skeleton className="h-48 w-full max-w-lg" />
                <div className="w-px h-8 bg-border"></div>
                <Skeleton className="h-32 w-full max-w-lg" />
                <div className="w-px h-8 bg-border"></div>
                <Skeleton className="h-48 w-full max-w-lg" />
              </>
            ) : run && run.steps && run.steps.length > 0 ? (
              run.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex flex-col items-center w-full max-w-lg"
                >
                  <WorkflowStepCard
                    step={step}
                    duration={calculateDuration(
                      step.createdAt,
                      step.updatedAt,
                      step.status
                    )}
                  />

                  <div className="w-px h-8 bg-border"></div>

                  <WorkflowStepOutputs outputs={step.outputs} />

                  {index < run.steps.length - 1 && (
                    <div className="w-px h-8 bg-border"></div>
                  )}
                </div>
              ))
            ) : (
              !isRunLoading &&
              !run?.steps?.length && (
                <Card className="max-w-lg w-full p-6 text-center text-muted-foreground">
                  No steps executed for this run yet.
                </Card>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
