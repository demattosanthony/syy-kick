import { useParams } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api";
import { useGetRunsQuery } from "@/features/workflows/features/runs/api/get-runs";
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
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useRunSSE } from "@/features/workflows/features/runs/hooks";

export function WorkflowRunPageDetails() {
  const { workflowId, runId } = useParams<{
    workflowId: string;
    runId: string;
  }>();

  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflowQuery(
    workflowId as string
  );
  const { data: runs, isLoading: isRunsLoading } = useGetRunsQuery(
    workflowId as string
  );
  // const { mutate: triggerRun, isPending: isTriggerRunPending, isError: isTriggerRunError } = useTriggerRunMutation();
  const run = runs?.find((r) => r.id === runId);

  useRunSSE({
    workflowId: workflowId as string,
    workflowRunId: runId as string,
  });

  // useEffect(() => {
  //     if (runId && workflowId) {
  //         triggerRun({ workflowId, workflowRunId: runId });
  //     }
  // }, [runId]);

  return (
    <div className="h-screen w-full flex flex-col">
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
                  {workflow?.name}
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

          <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full  ">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Run Details</h1>
              <Button variant="outline" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Runs
              </Button>
            </div>

            {isRunsLoading ? (
              <Skeleton className="h-40" />
            ) : run ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {workflow?.name}
                    </h2>
                    <p className="text-muted-foreground">
                      Created on {new Date(run.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      run.status === "completed" &&
                        "bg-green-100 text-green-800",
                      run.status === "running" && "bg-blue-100 text-blue-800",
                      run.status === "failed" && "bg-red-100 text-red-800",
                      run.status === "pending" &&
                        "bg-yellow-100 text-yellow-800"
                    )}
                  >
                    {run.status}
                  </div>
                </div>
              </Card>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Run not found
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
