import { FinishReason, LanguageModelUsage, ToolCall, ToolResult } from "ai";
import { ToolName } from "../../tools/types";

export type ArtifactEvent = {
  type: "created";
  filename: string;
  mimeType: string;
  fileKey: string;
  stepId: string;
  ts: number;
};

export type WorkflowStepStartData = {
  stepId: string;
  stepName: string;
};

export type WorkflowStepMessage = {
  stepId: string;
  stepName: string;
  text: string;
  toolCalls: ToolCall<ToolName, any>[];
  toolResults: ToolResult<ToolName, any, any>[];
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
