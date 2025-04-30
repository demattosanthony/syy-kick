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
  inputs: {
    id: string;
    type: string;
    title: string;
    description: string;
    acceptedFileTypes: string;
    required: boolean;
  }[];
  agents: Agent[];
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
      acceptedFileTypes?: string[];
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
