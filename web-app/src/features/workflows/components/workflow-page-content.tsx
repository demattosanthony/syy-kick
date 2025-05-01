import { Link, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Loader, Play, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "ai";
import ErrorDisplay from "./workflow-error-display";
import { Workflow, WorkflowExecutionInputValue } from "../workflows.types";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowFormFields } from "./workflow-form-fields";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import {
  useCreateRunMutation,
  useTriggerRunMutation,
} from "../features/runs/api";
import { useGetRunsQuery } from "../features/runs/api/get-runs";

export type WorkflowAttachment = Attachment & {
  file_key: string;
  inputId: string;
};

export default function WorkflowPageContent({
  workflowId,
  projectId,
  workflow,
  isLoading,
}: {
  workflowId: string;
  projectId?: string;
  workflow?: Workflow;
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<
    Record<string, Record<string, any>>
  >({});
  const [errorDetails, setErrorDetails] = useState<{
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null>(null);
  const hasAutoHiddenReasoning = useRef(false);
  const [highlightedStepIndex, setHighlightedStepIndex] = useState<
    number | null
  >(null);
  const { mutateAsync: createRunAsync, isPending: isCreatingRun } =
    useCreateRunMutation();
  const { mutateAsync: triggerRunAsync, isPending: isTriggeringRun } =
    useTriggerRunMutation();
  const { data: runs } = useGetRunsQuery(workflowId);

  // Initialize form values based on workflow steps
  useEffect(() => {
    if (workflow?.steps) {
      const initialValues: Record<string, Record<string, any>> = {};
      workflow.steps.forEach((step) => {
        if (step.formSchema) {
          initialValues[step.id] = {};
          Object.entries(step.formSchema.fields).forEach(([fieldId]) => {
            initialValues[step.id][fieldId] = "";
          });
        }
      });
      setFormValues(initialValues);
    }
  }, [workflow]);

  // Reset workflow state and reload page
  const resetWorkflow = () => {
    if (workflow?.steps) {
      const resetValues: Record<string, Record<string, any>> = {};
      workflow.steps.forEach((step) => {
        if (step.formSchema) {
          resetValues[step.id] = {};
          Object.entries(step.formSchema.fields).forEach(([fieldId]) => {
            resetValues[step.id][fieldId] = "";
          });
        }
      });
      setFormValues(resetValues);
    }
    setErrorDetails(null);
    hasAutoHiddenReasoning.current = false;
    if (errorDetails) window.location.reload();
  };

  // Check if all required fields are filled for a step
  const areRequiredFieldsFilled = (stepId: string) => {
    const step = workflow?.steps.find((s) => s.id === stepId);
    if (!step?.formSchema) return true;

    return Object.entries(step.formSchema.fields)
      .filter(
        ([_, field]) => field.required && field.referenceType !== "previousStep"
      )
      .every(([fieldId]) => {
        const value = formValues[stepId]?.[fieldId];
        if (
          value instanceof File ||
          (value && typeof value === "object" && "source" in value)
        ) {
          return true;
        }
        return value !== null && value !== undefined && value !== "";
      });
  };

  const areAllRequiredFieldsFilled = () => {
    if (!workflow?.steps) return false;

    return workflow.steps.every((step) => {
      if (!step.formSchema) return true;

      return areRequiredFieldsFilled(step.id);
    });
  };

  // Handle form submission
  const onSubmit = async () => {
    if (!areAllRequiredFieldsFilled()) return;

    // Transform formValues into inputValues
    const inputValues: Record<string, WorkflowExecutionInputValue> = {};

    // Iterate over each step
    for (const [stepId, stepValues] of Object.entries(formValues)) {
      // Iterate over each field of the step
      for (const [fieldId, value] of Object.entries(stepValues)) {
        const step = workflow?.steps.find((s) => s.id === stepId);
        const field = step?.formSchema?.fields[fieldId];

        if (!field) continue;

        // Create the input value based on the type
        if (field.type === "file" && value) {
          if ("source" in value && value.source === "project") {
            // Case of an existing file from the project
            inputValues[fieldId] = {
              type: "file",
              label: field.label,
              value: {
                fileKey: value.file_key,
                mimeType: value.type,
                filename: value.name,
              },
            };
          } else if (value instanceof File) {
            // Case of a new file uploaded
            const { url, file_metadata } = await api.uploads.getPresignedUrl(
              value.name,
              value.type,
              value.size,
              `uploads/${Date.now()}-${fieldId}-${value.name}`
            );

            await fetch(url, {
              method: "PUT",
              body: value,
              headers: { "Content-Type": value.type },
            });

            inputValues[fieldId] = {
              type: "file",
              label: field.label,
              value: {
                fileKey: file_metadata.file_key,
                mimeType: value.type,
                filename: value.name,
              },
            };
          }
        } else if (field.type === "text") {
          inputValues[fieldId] = {
            type: "text",
            label: field.label,
            value: {
              text: value as string,
            },
          };
        } else if (field.type === "number") {
          inputValues[fieldId] = {
            type: "number",
            label: field.label,
            value: {
              number: Number(value),
            },
          };
        }
      }
    }

    const run = await createRunAsync({
      workflowId,
      inputValues,
    });

    await triggerRunAsync({
      workflowId,
      workflowRunId: run.id,
    });

    navigate(`/workflows/${workflowId}/runs/${run.id}`);
  };

  if (workflow === null) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Workflow not found</h2>
        <Button onClick={() => navigate("/workflows")}>
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center w-full">
      {/* Header Section */}
      <div className="mb-12 text-center w-full flex flex-col items-center gap-4">
        <div className="inline-block p-3 mb-6 w-fit rounded-full bg-accent">
          <span className="text-4xl">📋</span>
        </div>
        {isLoading ? (
          <>
            <Skeleton className="w-xl h-10" />
            <Skeleton className="w-md h-10" />
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold mb-4">{workflow?.name}</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {workflow?.description}
            </p>
          </>
        )}
      </div>

      <ErrorDisplay errorDetails={errorDetails} onReset={resetWorkflow} />

      {/* Workflow Form Section */}
      {!errorDetails && workflow?.steps && (
        <div className="w-full mb-12">
          {/* <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-1 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold">Workflow Configuration</h2>
          </div> */}
          <div className="rounded-xl w-full">
            <div className="flex flex-col gap-8">
              {workflow.steps.slice(0, 1).map(
                (step, index) =>
                  step.formSchema && (
                    <div
                      key={step.id}
                      className={cn(
                        "space-y-4",
                        highlightedStepIndex === index - 1 && "border-primary"
                      )}
                    >
                      <WorkflowFormFields
                        onHoverPreviousStepOutputRef={() => {
                          const stepIndex = workflow.steps.findIndex(
                            (s) => s.id === step.id
                          );
                          if (stepIndex !== -1) {
                            setHighlightedStepIndex(stepIndex - 2);
                          }
                        }}
                        onLeavePreviousStepOutputRef={() => {
                          setHighlightedStepIndex(null);
                        }}
                        formSchema={step.formSchema}
                        values={formValues[step.id] || {}}
                        onChange={(fieldId, value) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [step.id]: { ...prev[step.id], [fieldId]: value },
                          }))
                        }
                        projectId={projectId}
                      />
                    </div>
                  )
              )}
              <Button
                className="w-full mt-6 py-7 text-lg font-medium transition-all hover:scale-[1.02]"
                size="lg"
                disabled={!areAllRequiredFieldsFilled()}
                onClick={onSubmit}
              >
                {isCreatingRun || isTriggeringRun ? (
                  <>
                    <Loader className="animate-spin h-6 w-6 mr-3" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-6 w-6 mr-3" />
                    {areAllRequiredFieldsFilled()
                      ? "Submit and run"
                      : "Fill in all required fields to continue"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Runs Section */}
      <div className="w-full mb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold">Recent Runs</h2>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(`/workflows/${workflowId}/runs`)}
          >
            <History className="w-4 h-4 mr-2" />
            View All Runs
          </Button>
        </div>

        <div className="grid gap-4">
          {runs?.slice(0, 3).map((run) => (
            <Link to={`/workflows/${workflowId}/runs/${run.id}`} key={run.id}>
              <Card
                key={run.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Run #{run.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
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
            </Link>
          ))}
          {(!runs || runs.length === 0) && (
            <p className="text-muted-foreground text-center py-4">
              No runs yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
