/** Ops */
import client from "../workflows.mastra.client";
import { workflowsMastraOps } from "../workflows.mastra.ops";

/** Utils */
import { runsUtils } from "./runs.utils";

export const workflowRunsOps = {
  createRun: async (workflowId: string, userId: string, input: any, organizationId?: string,) => {
    const workflow = client.getVNextWorkflow(workflowId);

    const inputSchema = (await workflow.details()).inputSchema;

    const validatedInput = runsUtils.validateInput(input, inputSchema);

    const run = await workflow.createRun();

    const start = await workflow.start({
      runId: run.runId,
      inputData: validatedInput,
    });

    return start;
  },
};
