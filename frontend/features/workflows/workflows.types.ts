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
