export interface Agent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  activeTools: string[];
}
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

export interface WorkflowProjectFile {
  source: "project";
  name: string;
  type: string;
  url: string;
  size: number;
  file_key: string;
}
