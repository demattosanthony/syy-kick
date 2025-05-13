import { useParams } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router";
import { Slash, ArrowLeft, Loader2, Circle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useRunSSE } from "@/features/workflows/features/runs/hooks";
import { useGetRunQuery } from "@/features/workflows/features/runs/api/get-run";
import { WorkflowRunInputs } from "@/features/workflows/features/runs/components/workflow-run-inputs";
import { WorkflowStepOutputs } from "@/features/workflows/features/runs/components/workflow-step-outputs";
import { cn } from "@/lib/utils";
import { useState, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { CustomWorkflowRun } from "@/features/workflows/workflows.types";

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

  const [openItemId, setOpenItemId] = useState<string | undefined>(undefined);

  const formatRunDate = (date: Date | undefined) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy HH:mm:ss");
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        );
      case "failed":
        return (
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </div>
        );
      case "running":
        return (
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        );
      case "suspended":
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getConnectorClassName = (status: string | undefined) => {
    switch (status) {
      case "running":
        return "bg-gray-400 animate-pulse";
      case "success":
      case "failed":
      case "suspended":
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="w-full flex flex-col flex-1">
      <div className="flex-1 w-full">
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

          <div className="flex items-center justify-between mb-4 max-w-3xl mx-auto w-full">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Run Details
              {runId && <Badge variant="secondary">#{runId.slice(0, 8)}</Badge>}
            </h1>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Runs
            </Button>
          </div>

          {isRunLoading && (
            <div className="mb-8 max-w-3xl mx-auto w-full flex items-center gap-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          )}

          <div className="max-w-3xl mx-auto w-full">
            {isRunLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : run ? (
              <Accordion
                type="single"
                collapsible
                className="w-full"
                value={openItemId || ""}
                onValueChange={(value) => setOpenItemId(value || undefined)}
              >
                {/* Inputs Section */}
                {Object.entries(run.snapshot.context)[0] && (
                  <AccordionItem
                    value="inputs"
                    className={cn(
                      "border rounded-md bg-card shadow-sm overflow-hidden mb-4"
                    )}
                  >
                    <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 text-base font-medium transition-colors cursor-pointer data-[state=open]:border-b">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-medium flex-1 text-left truncate text-lg">
                          Inputs
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-2 bg-card text-card-foreground">
                      <WorkflowRunInputs inputs={run.snapshot.context.input} />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Steps Section */}
                {Object.entries(run.snapshot.context)
                  .slice(1) // Skip the first entry (inputs)
                  .map(([stepId, stepData], index) => {
                    const status = stepData.status;
                    const error = stepData.error;
                    const output = stepData.output;
                    const isLastStep = index === Object.entries(run.snapshot.context).length - 2; // -2 because we exclude inputs

                    return (
                      <Fragment key={stepId}>
                        <AccordionItem
                          value={stepId}
                          className={cn(
                            "border rounded-md bg-card shadow-sm overflow-hidden"
                          )}
                        >
                          <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 text-base font-medium transition-colors cursor-pointer data-[state=open]:border-b">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(status)}
                              <span className="font-medium flex-1 text-left truncate text-lg">
                                Step {index + 1} - {stepId}
                              </span>

                              
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-4 pt-2 bg-card text-card-foreground">
                            {error && (
                              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive/80 text-sm italic">
                                {/* @todo: check with Anthony */}
                                {error?.message || 'An error occurred'}
                              </div>
                            )}
                            <div className="mb-4">
                              <h3 className="text-sm font-semibold mb-2">
                                Status
                              </h3>
                              <div className="text-sm">{status}</div>
                            </div>
                            {output && (
                              <div className="mb-4">
                                <h3 className="text-sm font-semibold mb-2">
                                  Output
                                </h3>
                                <WorkflowStepOutputs
                                  outputs={output}
                                  isLastStep={isLastStep}
                                />
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>

                        {!isLastStep && (
                          <div className="flex justify-center h-8">
                            <div
                              className={cn(
                                "w-px h-full",
                                getConnectorClassName(status)
                              )}
                            ></div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
              </Accordion>
            ) : (
              <Card className="w-full p-6 text-center text-muted-foreground">
                {isRunLoading
                  ? "Loading run details..."
                  : "No inputs or steps for this run yet."}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
