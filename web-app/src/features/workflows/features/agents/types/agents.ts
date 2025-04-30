import { WorkflowStepFormSchema } from "../../../workflows.types";

export type AgentType = "rfp" | "window_door_schedule" | "bill_of_materials" | "basis_of_design" | "equipment_serving_list";

export type Agent = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  model: string;
  activeTools: string[];
  requiredTools: string[];
  formSchema: WorkflowStepFormSchema | null;
  type: AgentType;
  createdAt: Date;
  updatedAt: Date;
};
