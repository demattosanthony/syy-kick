/** Ops */
import client from "../workflows.mastra.client";
import { VNextWorkflowWatchResult } from "@mastra/client-js";
import { CustomWorkflowRun } from "./runs.types";

/** Utils */
import { runsUtils } from "./runs.utils";

import { RuntimeContext } from "@mastra/core/di";

export const workflowRunsOps = {
  createRun: async (workflowId: string, input: any) => {
    try {
      const workflow = client.getVNextWorkflow(workflowId);

      const workflowDetails = await workflow.details();

      const inputSchema = workflowDetails.inputSchema;

      const validatedInput = runsUtils.validateInput(input, inputSchema);

      const run = await workflow.createRun();

      const context = new RuntimeContext();
      context.set("workflowId", workflowId);
      context.set("runId", run.runId);

      await workflow.start({
        runId: run.runId,
        inputData: validatedInput,
        runtimeContext: context,
      });

      return run;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getRuns: async (workflowId: string) => {
    const workflow = client.getVNextWorkflow(workflowId);
    const runs = await workflow.runs();
    return runs;
  },

  getRun: async (workflowId: string, runId: string): Promise<CustomWorkflowRun> => {
    const workflow = client.getVNextWorkflow(workflowId);
    const run = await workflow.runs();
    const foundRun = run.runs.find((run) => run.runId === runId);

    // Cast to any to bypass type checking issues (@todo: use their type once they fix the issue)
    const runWithAny = foundRun as any;

    // Presign inputs
    if (runWithAny?.snapshot?.context?.input) {
      runWithAny.snapshot.context.input = await runsUtils.presignInputs(runWithAny.snapshot.context.input);
    }

    // Presign outputs of each step
    if (runWithAny?.snapshot?.context) {
      for (const stepId in runWithAny.snapshot.context) {
        if (stepId !== 'input' && runWithAny.snapshot.context[stepId]?.output) {
          runWithAny.snapshot.context[stepId].output = await runsUtils.presignStepOutput(runWithAny.snapshot.context[stepId].output);
        }
      }
    }

    return runWithAny as CustomWorkflowRun;
  },

  watchRun: async (workflowId: string, runId: string, onEvent: (event: VNextWorkflowWatchResult) => void) => {
    const workflow = client.getVNextWorkflow(workflowId);
    await workflow.watch({ runId }, async (record) => {
      const formattedRecord = {
        ...record,
        payload: {
          ...record.payload,
          currentStep: record.payload.currentStep ? {
            ...record.payload.currentStep,
            output: await runsUtils.presignStepOutput(record.payload.currentStep.output),
          } : undefined,
          workflowState: {
            ...record.payload.workflowState,
            steps: Object.fromEntries(
              await Promise.all(
                Object.entries(record.payload.workflowState.steps).map(async ([key, step]: [string, any]) => [
                  key,
                  {
                    ...step,
                    output: await runsUtils.presignStepOutput(step.output),
                  },
                ])
              )
            ),
          },
        },
      };
      onEvent(formattedRecord);
    });
  }
};
