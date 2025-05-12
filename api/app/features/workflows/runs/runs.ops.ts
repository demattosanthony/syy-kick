/** Ops */
import client from "../workflows.mastra.client";

/** Utils */
import { runsUtils } from "./runs.utils";

export const workflowRunsOps = {
  createRun: async (workflowId: string, userId: string, input: any) => {
    try {
      const workflow = client.getVNextWorkflow(workflowId);

    const inputSchema = (await workflow.details()).inputSchema;

    const validatedInput = runsUtils.validateInput(input, inputSchema);

    const run = await workflow.createRun();

    await workflow.start({
        runId: run.runId,
        inputData: validatedInput,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

//   type WatchEvent = {
//     type: 'watch';
//     payload: {
//         currentStep?: {
//             id: string;
//             status: 'running' | 'success' | 'failed' | 'suspended';
//             output?: Record<string, any>;
//             payload?: Record<string, any>;
//         };
//         workflowState: {
//             status: 'running' | 'success' | 'failed' | 'suspended';
//             steps: Record<string, {
//                 status: 'running' | 'success' | 'failed' | 'suspended';
//                 output?: Record<string, any>;
//                 payload?: Record<string, any>;
//             }>;
//             output?: Record<string, any>;
//             payload?: Record<string, any>;
//         };
//     };
//     eventTimestamp: Date;
// };

  watchRun: async (workflowId: string, runId: string) => {
    const workflow = client.getVNextWorkflow(workflowId);

    await workflow.watch({ runId }, (record) => {
      console.log('::: Workflow status: ', record.payload.workflowState.status);
      console.log('::: Current step: ', record.payload.currentStep);
    }); 
  }
};
