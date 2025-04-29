import {
  Attachment,
  FinishReason,
  LanguageModelUsage,
  ToolCallUnion,
  ToolResultUnion,
} from "ai";
import { createToolSet } from "./workflows.registry";

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

export type Agent = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: ToolName[];
};

export type WorkflowInput = {
  id: string;
  type: "file" | "text" | "image";
  title: string;
  description: string;
  required: boolean;
  acceptedFileTypes: string[];
};

// Represents the actual values provided for a workflow execution
export type WorkflowExecutionInputValue = {
  data: Uint8Array | string; // Uint8Array for files/images, string for text
  mimeType?: string; // Required for files/images
  filename?: string; // Original filename for files/images
};
export type WorkflowExecutionInputValues = {
  [inputId: string]: WorkflowExecutionInputValue;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  inputs: WorkflowInput[];
  agents: Agent[];
  authorizedOrganizationIds: string[];
};

export type AgentStartData = {
  agentId: string;
  agentName: string;
};

// TODO: Add metadata, file paths of artifacts, etc.
export type AgentStepData = {
  agentId: string;
  agentName: string;
  text: string;
  toolCalls: WorkflowToolCall[];
  toolResults: WorkflowToolResult[];
  finishReason: FinishReason;
  usage: LanguageModelUsage;
};

export type AgentErrorData = {
  agentId: string;
  agentName: string;
  error: string;
};

export type AgentFinishData = {
  agentId: string;
  agentName: string;
  result?: any;
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
  | { type: "agent_start"; data: AgentStartData }
  | { type: "agent_step"; data: AgentStepData }
  | { type: "agent_finish"; data: AgentFinishData }
  | { type: "agent_error"; data: AgentErrorData }
  | { type: "workflow_complete"; data: WorkflowCompleteData }
  | { type: "workflow_error"; data: WorkflowErrorData };
export type WorkflowProgressCallback = (update: WorkflowProgressUpdate) => void;
