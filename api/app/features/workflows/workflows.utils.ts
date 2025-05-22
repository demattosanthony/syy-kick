// import { WorkflowWithRelations } from "./workflows.types";

// export const workflowsUtils = {
//   formatWorkflow: (workflow: WorkflowWithRelations) => {
//     return {
//       id: workflow.id,
//       name: workflow.name,
//       description: workflow.description,
//       steps: workflow.steps.map((step: any) => ({
//         id: step.id,
//         agentId: step.agentId,
//         name: step.name ?? step.agent?.name,
//         description: step.description ?? step.agent?.description,
//         instructions: step.instructions ?? step.agent?.instructions,
//         model: step.model ?? step.agent?.model,
//         activeTools: step.activeTools ?? step.agent?.activeTools,
//         formSchema: step.formSchema ?? step.agent?.formSchema,
//         parentStepId: step.parentStepId,
//       })),
//       createdAt: workflow.createdAt,
//       updatedAt: workflow.updatedAt,
//     };
//   },

//   formatWorkflows: (workflows: WorkflowWithRelations[]) => {
//     return workflows.map((workflow) => workflowsUtils.formatWorkflow(workflow));
//   },
// };
