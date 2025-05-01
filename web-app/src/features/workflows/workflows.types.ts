export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: string[];
}
// TODO: refacto this type
export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: {
    id: string;
    name: string;
    description: string;
    instructions: string;
    model: string;
    activeTools: string[];
    formSchema: WorkflowStepFormSchema | null;
    parentStepId: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepFormSchema {
  fields: {
    [key: string]: {
      type: "text" | "file" | "number" | "select" | "date";
      label: string;
      required: boolean;
      description?: string;
      // For previous steps outputs
      referenceType?: "previousStep" | "userInput";
      // For files
      acceptedFileTypes?: string | string[];
      maxFileSize?: number;
      // For select
      options?: Array<{
        label: string;
        value: string;
      }>;
    };
  };
}

export interface Step {
  id: string;
  agentId: string | null;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: string[];
  formSchema: WorkflowStepFormSchema | null;
}


export interface ModelSelectorProps {
  step: Step;
  models: Array<{
      name: string;
      provider: string;
      description?: string;
      supportedMimeTypes?: string[];
  }>;
  onModelChange: (modelName: string) => void;
  hasError: boolean;
  errorMessage?: string;
}

export interface FormFieldProps {
  fieldKey: string;
  field: WorkflowStepFormSchema['fields'][string];
  stepId: string;
  stepIndex: number;
  onFieldChange: (key: string, updatedField: WorkflowStepFormSchema['fields'][string]) => void;
  onDeleteField?: (key: string) => void;
}


export interface WorkflowProjectFile {
  source: "project";
  name: string;
  type: string;
  url: string;
  size: number;
  file_key: string;
}

export type WorkflowTextExecutionInputValue = {
  text: string;
};

export type WorkflowFileExecutionInputValue = {
  fileKey: string;
  mimeType: string;
  filename: string;
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

export type WorkflowRunRequest = {
  workflowId: string;
  inputValues: WorkflowExecutionInputValues;
};

export type WorkflowRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "waiting";

export type WorkflowRunStepStatus = "pending" | "running" | "completed" | "failed";

export type WorkflowRunStep = {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  status: WorkflowRunStepStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  userId: string;
  status: WorkflowRunStatus;
  inputValues?: WorkflowExecutionInputValues;
  steps: WorkflowRunStep[];
  createdAt: string;
  updatedAt: string;
};
