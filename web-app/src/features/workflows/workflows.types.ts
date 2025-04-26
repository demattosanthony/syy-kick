export interface Workflow {
  id: string;
  title: string;
  description: string;
  modelName: string;
  inputs: {
    id: string;
    type: string;
    title: string;
    description: string;
    acceptedFileTypes: string;
    required: boolean;
  }[];
  output: Record<string, any>;
  buttonText: string;
}

export interface WorkflowProjectFile {
  source: "project";
  name: string;
  type: string;
  url: string;
  size: number;
  file_key: string;
}
