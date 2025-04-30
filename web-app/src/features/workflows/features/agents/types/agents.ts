export type AgentFormSchema = {
  fields: {
    [key: string]: {
      type: "text" | "file" | "select" | "number";
      label: string;
      required: boolean;
      description?: string;
      acceptedFileTypes?: string[];
      options?: Array<{
        label: string;
        value: string;
      }>;
    };
  };
};

export type Agent = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  model: string;
  activeTools: string[];
  requiredTools: string[];
  formSchema: AgentFormSchema | null;
  createdAt: Date;
  updatedAt: Date;
};
