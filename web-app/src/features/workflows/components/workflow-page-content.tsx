import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader, Play, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "ai";
import ErrorDisplay from "./workflow-error-display";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowFormFields } from "./workflow-form-fields";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import {
  useCreateRunMutation,
} from "../features/runs/api";
import { useGetRunsQuery } from "../features/runs/api/get-runs";
import { GetVNextWorkflowResponse } from "@mastra/client-js";
import { CustomWorkflowRun, WorkflowInputSchemaParsed } from "../workflows.types";
import { z } from "zod";
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
  workflow?: GetVNextWorkflowResponse;
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
  const { mutateAsync: createRunAsync, isPending: isCreatingRun } =
    useCreateRunMutation();
  const [submittingRun, setSubmittingRun] = useState<boolean>(false);
  const { data: runs } = useGetRunsQuery(workflowId);

  const [workflowInputSchema, setWorkflowInputSchema] = useState<WorkflowInputSchemaParsed>();
  const [zodConditions, setZodConditions] = useState<Record<string, any>>({});

  useEffect(() => {
    if (workflow) {
      const workflowInputSchema = JSON.parse(workflow.inputSchema) as WorkflowInputSchemaParsed;
      setWorkflowInputSchema(workflowInputSchema);
    }

    if (workflow?.inputSchema) {
      const conditions: Record<string, z.ZodObject<any>> = {};
      const schema = JSON.parse(workflow.inputSchema) as WorkflowInputSchemaParsed;

      Object.entries(schema.json.properties).forEach(([key, property]: [string, any]) => {
        let zodSchema = z.object({});

        if (property.required) {
          property.required.forEach((requiredField: string) => {
            const fieldSchema = property.properties[requiredField];

            if (fieldSchema.type === 'string') {
              if (fieldSchema.const) {
                zodSchema = zodSchema.extend({
                  [requiredField]: z.literal(fieldSchema.const)
                });
              } else {
                zodSchema = zodSchema.extend({
                  [requiredField]: z.string()
                });
              }
            } else if (fieldSchema.type === 'object') {
              if (requiredField === 'value') {
                zodSchema = zodSchema.extend({
                  value: z.object({
                    mimeType: z.string(),
                    fileName: z.string(),
                    fileKey: z.string()
                  })
                });
              }
            }
          });
        }

        conditions[key] = zodSchema;
      });

      setZodConditions(conditions);
    }
  }, [workflow]);

  // Reset workflow state and reload page
  const resetWorkflow = () => {
    if (workflow?.steps) {
      const resetValues: Record<string, Record<string, any>> = {};
      setFormValues(resetValues);
    }
    setErrorDetails(null);
    hasAutoHiddenReasoning.current = false;
    if (errorDetails) window.location.reload();
  };

  const areAllRequiredFieldsFilled = () => {
    const inputValues: Record<string, any> = {};

    Object.entries(formValues).forEach(([key, value]) => {
      const property = workflowInputSchema?.json.properties[key];
      if (!property) return;

      if (value instanceof File) {
        inputValues[key] = {
          type: property.properties.type.const,
          label: property.properties.label.const,
          value: {
            mimeType: value.type,
            fileName: value.name,
            fileKey: 'tmp',
          }
        }
      } else {
        inputValues[key] = {
          type: property.properties.type.const,
          label: property.properties.label.const,
          value: value
        }
      }
    });

    if (!workflow?.inputSchema || Object.keys(zodConditions).length === 0) return false;

    try {
      const finalZodSchema = z.object(zodConditions);
      finalZodSchema.parse(inputValues);
      return true;
    } catch (error) {
      console.error('Requirement validation error:', error);
      return false;
    }
  };

  // Handle form submission
  const onSubmit = async () => {
    if (!areAllRequiredFieldsFilled()) return;

    setSubmittingRun(true);

    const inputValues: Record<string, any> = {};

    const filePromises = Object.entries(formValues).map(async ([key, value]) => {
      const property = workflowInputSchema?.json.properties[key];
      if (!property) return;

      if (value instanceof File) {
        const { url, file_metadata } = await api.uploads.getPresignedUrl(
          value.name,
          value.type,
          value.size,
          `uploads/${Date.now()}-${key}-${value.name}`
        );

        //   {
        //     "url": "http://localhost:9000/my-new-bucket/uploads/1747147367722-controlsDrawings-Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin%2F20250513%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250513T144247Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=081341da8ecdba776e58bb7d9ea3d6024c9e6fe0efba45ecdab048da40ffc613",
        //     "viewUrl": "http://localhost:9000/my-new-bucket/uploads/1747147367722-controlsDrawings-Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=minioadmin%2F20250513%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250513T144247Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=7987bff0d2b7f2f730d797c5682772df5c6df8b5bbc6589397d217b80e9400d5",
        //     "file_metadata": {
        //         "filename": "Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf",
        //         "mime_type": "application/pdf",
        //         "file_key": "uploads/1747147367722-controlsDrawings-Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf",
        //         "size": 1743928
        //     }
        // }

        await fetch(url, {
          method: "PUT",
          body: value,
          headers: { "Content-Type": value.type },
        });

        inputValues[key] = {
          type: property.properties.type.const,
          label: property.properties.label.const,
          value: {
            fileKey: file_metadata.file_key,
            mimeType: file_metadata.mime_type,
            fileName: file_metadata.filename,
          }
        }
      } else {
        inputValues[key] = {
          type: property.properties.type.const,
          label: property.properties.label.const,
          value: value
        }
      }
    });

    try {
      await Promise.all(filePromises);

      const finalZodSchema = z.object(zodConditions);

      const validatedInput = finalZodSchema.parse(inputValues);

      const run = await createRunAsync({
        workflowId,
        input: validatedInput
      });

      navigate(`/workflows/${workflowId}/runs/${run.runId}`);

    } catch (error) {
      console.error('Validation error:', error);
      setErrorDetails({
        type: 'general',
        message: 'Erreur lors de la validation des données du formulaire'
      });
    } finally {
      setSubmittingRun(false);
    }
  }

  const lastGraphStep = useMemo(() => {
    if (!workflow?.stepGraph) return null;
    return workflow.stepGraph[workflow.stepGraph.length - 1];
  }, [workflow]);

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center w-full">
      {/* Header Section */}
      <div className="my-12 text-center w-full flex flex-col items-center gap-4">
        {isLoading ? (
          <>
            <Skeleton className="w-xl h-10" />
            <Skeleton className="w-md h-10" />
          </>
        ) : (
          <>
            <h1 className="text-4xl font-bold mb-4">{workflow?.name}</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              {/* {workflow?.description} */}
            </p>
          </>
        )}
      </div>

      <ErrorDisplay errorDetails={errorDetails} onReset={resetWorkflow} />

      {/* Workflow Form Section */}
      {!errorDetails && workflow?.steps && (
        <div className="w-full mb-12">
          <div className="rounded-xl w-full">
            <div className="flex flex-col gap-8">
              {workflowInputSchema && (
                <Card>
                  <CardContent>
                    <WorkflowFormFields
                      formSchema={workflowInputSchema.json.properties}
                      values={formValues}
                      onChange={(fieldId, value) => setFormValues((prev) => ({
                        ...prev,
                        [fieldId]: value
                      }))}
                      projectId={projectId}
                    />
                  </CardContent>
                </Card>
              )
              }
              <div className="flex justify-center">
                <Button
                  className="mt-6 py-7 text-lg font-medium transition-all hover:scale-[1.02] px-12"
                  size="lg"
                  disabled={!areAllRequiredFieldsFilled()}
                  onClick={onSubmit}
                >
                  {isCreatingRun || submittingRun ? (
                    <>
                      <Loader className="animate-spin h-6 w-6 mr-3" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-6 w-6 mr-3" />
                      {"Submit and run"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
      }

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
          {runs &&
            runs?.runs?.slice(0, 3).map((run: CustomWorkflowRun) => {

              if (!run.snapshot.context[Object.keys(run.snapshot.context)[Object.keys(run.snapshot.context).length - 1]]) {
                return null;
              }

              let status = "running"; 

              if (lastGraphStep && ("step" in lastGraphStep)) {
                const id = lastGraphStep.step.id;
                status = run.snapshot.context[id]?.status ?? "running";
              }

              return (
                <Link to={`/workflows/${workflowId}/runs/${run.runId}`} key={run.runId}>
                  <Card
                    key={run.runId}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Run #{run.runId.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(run.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          status === "success" &&
                          "bg-green-100 text-green-800",
                          status === "failed" && "bg-red-100 text-red-800",
                          status === "suspended" && "bg-yellow-100 text-yellow-800",
                          status === "waiting" && "bg-blue-100 text-blue-800",
                          status === "skipped" && "bg-gray-100 text-gray-800",
                          status === "running" && "bg-blue-100 text-blue-800"
                        )}
                      >
                        {status}
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })
            }
          {(!runs || runs.runs.length === 0) && (
            <p className="text-muted-foreground text-center py-4">
              No runs yet
            </p>
          )}
        </div>
      </div>
    </div >
  );
}
