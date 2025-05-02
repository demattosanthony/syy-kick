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
import { StepMessagesDisplay } from "@/features/workflows/features/runs/components/workflow-step-card";
import { useState, useEffect, useRef, Fragment } from "react";
import { WorkflowRunStep } from "@/features/workflows/workflows.types";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

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
  const previousStepsRef = useRef<WorkflowRunStep[] | undefined>(undefined);
  const inputsExist =
    run?.executionInputValues &&
    Object.keys(run.executionInputValues).length > 0;

  useEffect(() => {
    if (run?.steps || inputsExist) {
      const isInitialLoad = previousStepsRef.current === undefined;

      // Handle initial load accordion state
      if (isInitialLoad && openItemId === undefined) {
        let itemToOpen: string | undefined = undefined;

        if (run?.steps && run.steps.length > 0) {
          const allStepsTerminal = run.steps.every(
            (step) => step.status === "completed" || step.status === "failed"
          );

          if (allStepsTerminal) {
            // Priority 1: All steps done? Open the last actual step.
            itemToOpen = run.steps[run.steps.length - 1].id;
          } else {
            // Priority 2: Not all steps done? Find the first non-terminal step.
            const firstNonTerminalStep = run.steps.find(
              (step) => step.status !== "completed" && step.status !== "failed"
            );
            if (firstNonTerminalStep) {
              itemToOpen = firstNonTerminalStep.id;
            }
          }
        }

        // Priority 3: If no step was selected above (e.g., steps empty/pending) AND inputs exist, open inputs.
        if (itemToOpen === undefined && inputsExist) {
          itemToOpen = "inputs";
        }

        // Set the state if we determined an item to open
        if (itemToOpen !== undefined) {
          setOpenItemId(itemToOpen);
        }
      }
      // Handle auto-closing/opening based on step status changes AFTER initial load
      else if (
        openItemId &&
        openItemId !== "inputs" &&
        previousStepsRef.current &&
        run?.steps &&
        previousStepsRef.current !== run.steps
      ) {
        const currentOpenStepIndex = run.steps.findIndex(
          (step) => step.id === openItemId
        );

        if (currentOpenStepIndex !== -1) {
          const currentOpenStep = run.steps[currentOpenStepIndex];
          const prevOpenStep = previousStepsRef.current.find(
            (step) => step.id === openItemId
          );

          // Auto-close & open next logic: Only activate if the step just completed AND it's NOT the last step
          if (
            prevOpenStep &&
            currentOpenStep.status === "completed" &&
            prevOpenStep.status !== "completed" &&
            currentOpenStepIndex < run.steps.length - 1 // Only trigger if there IS a next step
          ) {
            const nextStep = run.steps[currentOpenStepIndex + 1];
            if (nextStep) {
              setOpenItemId(nextStep.id); // Open the next step
            } else {
              setOpenItemId(undefined); // Fallback: close if next step somehow doesn't exist (shouldn't happen with the index check)
            }
          }
        }
      }

      previousStepsRef.current = run?.steps;
    } else {
      // Reset if run data disappears
      previousStepsRef.current = undefined;
      if (openItemId !== undefined) {
        setOpenItemId(undefined);
      }
    }
  }, [run?.steps, run?.executionInputValues, inputsExist, openItemId]);

  const calculateDuration = (start: string, end: string, status: string) => {
    if (!start || !end || (status !== "completed" && status !== "failed"))
      return null;
    try {
      const durationMs = new Date(end).getTime() - new Date(start).getTime();
      if (isNaN(durationMs) || durationMs < 0) return null;
      const durationSec = durationMs / 1000;
      if (durationSec < 1) {
        return `${durationMs}ms`;
      } else if (durationSec < 60) {
        return `${durationSec.toFixed(1)}s`;
      } else {
        return `${Math.floor(durationSec / 60)}m ${Math.round(
          durationSec % 60
        )}s`;
      }
    } catch (e) {
      console.error("Error calculating duration:", e);
      return null;
    }
  };

  // Simpler status indicator for the header
  const getHeaderStatusDisplay = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="capitalize">{status}</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="capitalize">{status}</span>
          </div>
        );
      case "running":
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="capitalize">{status}</span>
          </div>
        );
      case "pending":
      default:
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="capitalize">{status}</span>
          </div>
        );
    }
  };

  const formatRunDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
  };

  // Original status icon function for accordion steps
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
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
      case "pending":
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getConnectorClassName = (status: string | undefined) => {
    switch (status) {
      case "running":
        // Simple pulse animation for running state
        return "bg-blue-500 animate-pulse";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "pending":
      default:
        // Solid grey line for pending/default
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

          {!isRunLoading && run && (
            <div className="mb-8 max-w-3xl mx-auto w-full text-sm text-muted-foreground flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                {/* Use the new header status display */}
                {getHeaderStatusDisplay(run.status)}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Started:</span>
                <span>{formatRunDate(run.createdAt)}</span>
              </div>
            </div>
          )}

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
            ) : run && (inputsExist || (run.steps && run.steps.length > 0)) ? (
              <Accordion
                type="single"
                collapsible
                className="w-full"
                value={openItemId || ""}
                onValueChange={(value) => setOpenItemId(value || undefined)}
              >
                {inputsExist && (
                  <Fragment key="inputs-fragment">
                    <AccordionItem
                      value="inputs"
                      key="inputs"
                      className={cn(
                        "border rounded-md bg-card shadow-sm overflow-hidden",
                        run.steps && run.steps.length > 0 && "mb-4"
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
                        <WorkflowRunInputs inputs={run.executionInputValues!} />
                      </AccordionContent>
                    </AccordionItem>
                    {run.steps && run.steps.length > 0 && (
                      <div className="flex justify-center h-4 mb-4">
                        <div
                          className={cn(
                            "w-px h-full",
                            getConnectorClassName(run.steps[0]?.status)
                          )}
                        ></div>
                      </div>
                    )}
                  </Fragment>
                )}

                {run.steps?.map((step, index) => {
                  const duration = calculateDuration(
                    step.createdAt,
                    step.updatedAt,
                    step.status
                  );
                  const stepTitle = `Step ${index + 1} - ${
                    step.workflowStep?.name
                  }`;
                  const isLastStep = index === run.steps.length - 1;
                  const nextStepStatus = run.steps[index + 1]?.status;

                  return (
                    <Fragment key={step.id}>
                      <AccordionItem
                        value={step.id}
                        className={cn(
                          "border rounded-md bg-card shadow-sm overflow-hidden",
                          !isLastStep && "mb-4"
                        )}
                      >
                        <AccordionTrigger className="hover:bg-muted/50 px-4 py-3 text-base font-medium transition-colors cursor-pointer data-[state=open]:border-b">
                          <div className="flex items-center gap-3 flex-1">
                            {getStatusIcon(step.status)}
                            <span className="font-medium flex-1 text-left truncate text-lg">
                              {stepTitle}
                            </span>
                            {duration && (
                              <span className="text-sm text-muted-foreground mr-2">
                                {duration}
                              </span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 pt-2 bg-card text-card-foreground">
                          {step.status === "failed" && (
                            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive/80 text-sm italic">
                              Step failed.
                            </div>
                          )}
                          <div className="mb-4">
                            <h3 className="text-sm font-semibold mb-2">
                              Messages
                            </h3>
                            <StepMessagesDisplay messages={step.messages} />
                          </div>
                          <h3 className="text-sm font-semibold mb-2 ">
                            Outputs
                          </h3>
                          <WorkflowStepOutputs
                            outputs={step.outputs}
                            isLastStep={isLastStep}
                          />
                        </AccordionContent>
                      </AccordionItem>

                      {!isLastStep && (
                        <div className="flex justify-center h-4 mb-4">
                          <div
                            className={cn(
                              "w-px h-full",
                              getConnectorClassName(nextStepStatus)
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
