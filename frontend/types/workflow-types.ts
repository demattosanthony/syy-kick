export interface Workflow {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface InputNodeConfig {
  fields?: Array<{
    id: string;
    label: string;
    type: "text" | "file";
    required?: boolean;
    options?: Array<{
      label: string;
      value: string;
    }>;
    accept?: string;
    multiple?: boolean;
    maxFileSize?: number;
  }>;
}

export interface LlmAgentConfig {
  prompt?: string;
  system?: string;
  model?: string;
  tools?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface WorkflowNode {
  id: string;
  workflowId: string;
  type: "input" | "llm-agent";
  positionX: number;
  positionY: number;
  config: InputNodeConfig | LlmAgentConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEdge {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  targetNodeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowWithRelations extends Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
