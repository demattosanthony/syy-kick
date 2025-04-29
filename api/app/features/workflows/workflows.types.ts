import {
  Attachment,
  FinishReason,
  LanguageModelUsage,
  ToolCallUnion,
  ToolResultUnion,
} from "ai";
import { createToolSet } from "./workflows.registry";
import { ArtifactData, ArtifactEvent } from "./artifact-service";

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

// Define tool names based on the keys of the toolSet object
export type WorkflowToolSet = ReturnType<typeof createToolSet>;
export type ToolName = keyof WorkflowToolSet;

// Define union types for tool calls and results based on the toolSet
export type WorkflowToolCall = ToolCallUnion<WorkflowToolSet>;
export type WorkflowToolResult = ToolResultUnion<WorkflowToolSet>;

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
  toolCalls: WorkflowToolCall[];
  toolResults: WorkflowToolResult[];
  finishReason: FinishReason;
  usage: LanguageModelUsage;
  role: "system" | "user" | "assistant" | "tool";
};

export type WorkflowStepErrorData = {
  stepId: string;
  stepName: string;
  error: string;
};

export type WorkflowStepOutput = {
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
  | { type: "workflow_step_output"; data: WorkflowStepOutput }
  | { type: "workflow_step_error"; data: WorkflowStepErrorData }
  | { type: "workflow_complete"; data: WorkflowCompleteData }
  | { type: "workflow_error"; data: WorkflowErrorData };
export type WorkflowProgressCallback = (update: WorkflowProgressUpdate) => void;
