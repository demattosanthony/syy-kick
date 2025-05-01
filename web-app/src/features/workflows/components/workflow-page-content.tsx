import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Loader, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "ai";
import api from "@/lib/api";
import ErrorDisplay from "./workflow-error-display";
import { Workflow } from "../workflows.types";
import { useAtom } from "jotai";
import { initalInputAtom, workflowInputAtom } from "@/atoms/chat";
import { ThreadsList } from "@/features/chat/threads/components";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowFormFields } from "./workflow-form-fields";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  const [formValues, setFormValues] = useState<Record<string, Record<string, any>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null>(null);
  const hasAutoHiddenReasoning = useRef(false);
  const [, setWorkflowInput] = useAtom(workflowInputAtom);
  const [, setInitalInput] = useAtom(initalInputAtom);
  const [highlightedStepIndex, setHighlightedStepIndex] = useState<number | null>(null);

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
      .filter(([_, field]) => field.required && field.referenceType !== "previousStep")
      .every(([fieldId]) => {
        const value = formValues[stepId]?.[fieldId];
        if (value instanceof File || (value && typeof value === "object" && "source" in value)) {
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

    console.log(JSON.stringify(formValues, null, 2));
  
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
      <div className="mb-6 text-center w-full flex flex-col items-center gap-4">
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

      {!errorDetails && workflow?.steps && (
        <div className="rounded-xl p-8 w-full">
          <div className="flex flex-col gap-8">
            {workflow.steps.map((step, index) => (
              step.formSchema && (
                <Card key={step.id} className={cn("space-y-4 p-4", highlightedStepIndex === index - 1 && "border-primary")}>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{`Step ${index + 1} - ${step.name}`}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                  <h3 className="text-lg font-semibold">Step inputs:</h3>
                  <WorkflowFormFields
                    onHoverPreviousStepOutputRef={(fieldId) => {
                      const stepIndex = workflow.steps.findIndex((s) => s.id === step.id);
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
                </Card>
              )
            ))}
            <Button
              className="w-full mt-6 py-7 text-lg font-medium transition-all hover:scale-[1.02]"
              size="lg"
              disabled={!areAllRequiredFieldsFilled()}
              onClick={onSubmit}
            >
              {isSubmitting ? (
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
      )}

      {/* History section */}
      <div className="mt-12 w-full max-w-xl">
        <h2 className="text-2xl font-bold mb-6">History</h2>
        <div className="">
          <ThreadsList workflowId={workflowId} showLatestMessage={false} />
        </div>
      </div>
    </div>
  );
}
