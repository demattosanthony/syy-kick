import { FinishReason, LanguageModelUsage } from "ai";
import { ArtifactEvent } from "./artifact-service";
import { ToolName, ToolCall, ToolResult } from "../tools/tools.types";
import { z } from "zod";
import { InferSelectModel } from "drizzle-orm";
import { workflows, workflowSteps, WorkflowStep } from "./workflows.schema";
import { agents } from "./agents/agents.schema";

export interface WorkflowStepFormSchema {
  fields: {
    [key: string]: {
      type: "text" | "file" | "number";
      label: string;
      required: boolean;
      description?: string;
      // For previous steps outputs
      referenceType?: "previousStep" | "userInput";
      // For files
      acceptedFileTypes?: string[];
      // For select
      options?: Array<{
        label: string;
        value: string;
      }>;
    };
  };
}

export type WorkflowTextExecutionInputValue = {
  text: string;
};

export type WorkflowFileExecutionInputValue = {
  fileKey: string;
  mimeType: string;
  filename: string;
  url?: string;
};

export type WorkflowNumberExecutionInputValue = {
  number: number;
};

export type WorkflowExecutionInputValue = {
  type: "text" | "file" | "number";
  label: string;
  value:
    | WorkflowTextExecutionInputValue
    | WorkflowFileExecutionInputValue
    | WorkflowNumberExecutionInputValue;
};
export type WorkflowExecutionInputValues = {
  [inputId: string]: WorkflowExecutionInputValue;
};

// Zod Schemas for Validation
export const WorkflowTextExecutionInputValueSchema = z.object({
  text: z.string(),
});

export const WorkflowFileExecutionInputValueSchema = z.object({
  fileKey: z.string(),
  mimeType: z.string(),
  filename: z.string(),
  url: z.string().optional(),
});

export const WorkflowNumberExecutionInputValueSchema = z.object({
  number: z.number(),
});

export const WorkflowExecutionInputValueSchema = z
  .object({
    type: z.enum(["text", "file", "number"]),
    label: z.string(),
    value: z.union([
      WorkflowTextExecutionInputValueSchema,
      WorkflowFileExecutionInputValueSchema,
      WorkflowNumberExecutionInputValueSchema,
    ]),
  })
  .refine(
    (data) => {
      // Ensure the value type matches the specified type
      if (data.type === "text") {
        return WorkflowTextExecutionInputValueSchema.safeParse(data.value)
          .success;
      } else if (data.type === "file") {
        return WorkflowFileExecutionInputValueSchema.safeParse(data.value)
          .success;
      } else if (data.type === "number") {
        return WorkflowNumberExecutionInputValueSchema.safeParse(data.value)
          .success;
      }
      return false;
    },
    {
      message: "Value object does not match the specified type",
      path: ["value"], // Point the error to the value field
    }
  );

export const WorkflowExecutionInputValuesSchema = z.record(
  WorkflowExecutionInputValueSchema
);

export type WorkflowRunStep = {
  id: string;
  agentId?: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: ToolName[];
  formSchema?: WorkflowStepFormSchema;
};

export type WorkflowRun = {
  runId: string;
  workflowId: string;
  name: string;
  description?: string;
  executionInputValues: Record<string, WorkflowExecutionInputValue>;
  workflowSteps: WorkflowRunStep[];
};

export type WorkflowStepStartData = {
  stepId: string;
  stepName: string;
};

export type WorkflowStepMessageToolCall = {
  id: string;
  toolName: ToolName;
  args: Record<string, any>;
  createdAt: string;
  result: Record<string, any>;
  status: "pending" | "completed" | "failed";
};

export type WorkflowStepMessage = {
  stepId: string;
  stepName: string;
  text: string;
  reasoning?: string;
  toolCalls: WorkflowStepMessageToolCall[];
  finishReason: FinishReason;
  usage: LanguageModelUsage;
  role: "system" | "user" | "assistant" | "tool";
};

export type WorkflowStepErrorData = {
  stepId: string;
  stepName: string;
  error: string;
};

export type WorkflowStepFinishData = {
  stepId: string;
  stepName: string;
};

export type WorkflowStepArtifactEvent = {
  stepId: string;
  stepName: string;
  artifact: ArtifactEvent;
};

export type WorkflowStartData = {
  workflowId: string;
  workflowName: string;
};

export type WorkflowCompleteData = {
  workflowId: string;
  workflowName: string;
};

export type WorkflowErrorData = {
  workflowId: string;
  workflowName: string;
  error: string;
};

// Type for progress updates
export type WorkflowProgressUpdate =
  | { type: "workflow_start"; data: WorkflowStartData }
  | { type: "workflow_step_start"; data: WorkflowStepStartData }
  | { type: "workflow_step_message"; data: WorkflowStepMessage }
  | { type: "workflow_step_artifact_event"; data: WorkflowStepArtifactEvent }
  | { type: "workflow_step_finish"; data: WorkflowStepFinishData }
  | { type: "workflow_step_error"; data: WorkflowStepErrorData }
  | { type: "workflow_complete"; data: WorkflowCompleteData }
  | { type: "workflow_error"; data: WorkflowErrorData };
export type WorkflowProgressCallback = (update: WorkflowProgressUpdate) => void;

export type WorkflowCreateRequest = {
  name: string;
  description?: string;
  workflowSteps: Omit<WorkflowRunStep, "id">[];
};

export type WorkflowWithRelations = InferSelectModel<typeof workflows> & {
  steps: (InferSelectModel<typeof workflowSteps> & {
    agent: InferSelectModel<typeof agents> | null;
  })[];
};

export type WorkflowStepUpdateInput = Omit<
  WorkflowStep,
  "id" | "workflowId" | "parentStepId" | "createdAt" | "updatedAt"
>;

export type WorkflowUpdateRequest = {
  name?: string;
  description?: string;
  workflowSteps: WorkflowStepUpdateInput[];
};
