import { Attachment, FinishReason, LanguageModelUsage } from "ai";
import { ArtifactEvent } from "./artifact-service";
import { ToolName, ToolCall, ToolResult } from "../tools/tools.types";

export interface WorkflowStepFormSchema {
  fields: {
    [key: string]: {
      type: "text" | "file" | "select" | "number";
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

export type WorkflowAttachment = Attachment & {
  file_key: string;
  inputId: string;
};

export type WorkflowTextExecutionInputValue = {
  text: string;
};

export type WorkflowFileExecutionInputValue = {
  data: Uint8Array;
  mimeType: string;
  filename: string;
};

// Represents the actual values provided for a workflow execution
export type WorkflowExecutionInputValue = {
  // value will contain the raw text data, or an S3 key/URI for files/images
  type: "text" | "file";
  value: WorkflowTextExecutionInputValue | WorkflowFileExecutionInputValue;
};
export type WorkflowExecutionInputValues = {
  [inputId: string]: WorkflowExecutionInputValue;
};

export type WorkflowStep = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: ToolName[];
  formSchema?: WorkflowStepFormSchema;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  workflowSteps: WorkflowStep[];
  authorizedOrganizationIds: string[];
};

export type WorkflowStepStartData = {
  stepId: string;
  stepName: string;
  //   artifacts: ArtifactEvent[];
};

// TODO: Add metadata, file paths of artifacts, etc.
export type WorkflowStepMessage = {
  stepId: string;
  stepName: string;
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
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
  artifacts: ArtifactEvent[];
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
  | { type: "workflow_step_finish"; data: WorkflowStepFinishData }
  | { type: "workflow_step_error"; data: WorkflowStepErrorData }
  | { type: "workflow_complete"; data: WorkflowCompleteData }
  | { type: "workflow_error"; data: WorkflowErrorData };
export type WorkflowProgressCallback = (update: WorkflowProgressUpdate) => void;
