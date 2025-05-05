import { useNavigate, useParams } from "react-router";
import { useGetRunsQuery } from "@/features/workflows/features/runs/api/get-runs";
import { useWorkflowQuery } from "@/features/workflows/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Slash, ArrowLeft, Play, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useTriggerRunMutation } from "@/features/workflows/features/runs/api";

export function WorkflowRunsPage() {
  const navigate = useNavigate();
  const { workflowId } = useParams<{
    workflowId: string;
  }>();

  const { data: workflow } = useWorkflowQuery(workflowId as string);
  const { data: runs, isLoading: isRunsLoading } = useGetRunsQuery(
    workflowId as string
  );
  const {
    mutate: triggerRun,
    // isPending: isTriggerRunPending,
    // isError: isTriggerRunError,
  } = useTriggerRunMutation();

  const handleTriggerRun = (workflowId: string, workflowRunId: string) => {
    triggerRun({ workflowId, workflowRunId });
    navigate(`/workflows/${workflowId}/runs/${workflowRunId}`);
  };

  console.log(runs);

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="flex-1 ">
        <div className="mx-auto px-4 py-4 w-full">
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
                <span className="font-bold">Runs</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full  ">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Workflow Runs</h1>
              <Link to={`/workflows/${workflowId}`}>
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Workflow
                </Button>
              </Link>
            </div>

            {isRunsLoading ? (
              <div className="grid gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                {runs?.map((run) => (
                  <Card key={run.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">
                          Run #{run.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Created on{" "}
                          {new Date(run.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "px-3 py-1 rounded-full text-sm font-medium",
                            run.status === "completed" &&
                              "bg-green-100 text-green-800",
                            run.status === "running" &&
                              "bg-blue-100 text-blue-800",
                            run.status === "failed" &&
                              "bg-red-100 text-red-800",
                            run.status === "pending" &&
                              "bg-yellow-100 text-yellow-800"
                          )}
                        >
                          {run.status}
                        </div>
                        <Link to={`/workflows/${workflowId}/runs/${run.id}`}>
                          <Button size="sm" className="gap-2">
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                        </Link>
                        {run.status === "pending" && (
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              handleTriggerRun(workflowId as string, run.id)
                            }
                          >
                            <Play className="w-4 h-4" />
                            Run
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">Steps</h3>
                      <div className="grid gap-2">
                        {run.steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-center justify-between p-2 bg-muted rounded-md"
                          >
                            <div>
                              <p className="font-medium">Step {index + 1}</p>
                              <p className="text-sm text-muted-foreground">
                                {step.name}
                              </p>
                            </div>
                            <div
                              className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium",
                                step.status === "completed" &&
                                  "bg-green-100 text-green-800",
                                step.status === "running" &&
                                  "bg-blue-100 text-blue-800",
                                step.status === "failed" &&
                                  "bg-red-100 text-red-800",
                                step.status === "pending" &&
                                  "bg-yellow-100 text-yellow-800"
                              )}
                            >
                              {step.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
                {(!runs || runs.length === 0) && (
                  <p className="text-muted-foreground text-center py-8">
                    No runs found
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
