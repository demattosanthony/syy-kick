/** Ops */
import client from "../workflows.mastra.client";
import { VNextWorkflowWatchResult } from "@mastra/client-js";
import { CustomWorkflowRun } from "./runs.types";

/** Utils */
import { runsUtils } from "./runs.utils";

import { RuntimeContext } from "@mastra/core/di";
import { s3 } from "bun";

const presignFiles = async (files: any[]) => {
  if (!Array.isArray(files)) return files;
  return Promise.all(
    files.map(async (file) => {
      if (file.type === "file" && file.file) {
        return {
          ...file,
          file: runsUtils.presignFile(file.file),
        };
      }
      return file;
    })
  );
};

const presignStepOutput = async (output: any) => {
  if (!output) return output;
  const presignedOutput = { ...output };
  
  for (const key in presignedOutput) {
    const value = presignedOutput[key];
    if (Array.isArray(value)) {
      presignedOutput[key] = await presignFiles(value);
    }
  }
  
  return presignedOutput;
};

const presignInputs = async (inputs: Record<string, any>) => {
  const presignedInputs = { ...inputs };
  
  for (const key in presignedInputs) {
    const input = presignedInputs[key];
    if (input.type === "file" && input.value?.fileKey) {
      presignedInputs[key] = {
        ...input,
        value: runsUtils.presignFile(input.value),
      };
    }
  }
  
  return presignedInputs;
};

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

    if (!foundRun) {
      throw new Error(`Run ${runId} not found`);
    }

    // Cast to any to bypass type checking issues
    const runWithAny = foundRun as any;

    // Présigner les inputs
    if (runWithAny.snapshot?.context?.input) {
      runWithAny.snapshot.context.input = await presignInputs(runWithAny.snapshot.context.input);
    }

    // Présigner les outputs de chaque étape
    if (runWithAny.snapshot?.context) {
      for (const stepId in runWithAny.snapshot.context) {
        if (stepId !== 'input' && runWithAny.snapshot.context[stepId]?.output) {
          runWithAny.snapshot.context[stepId].output = await presignStepOutput(runWithAny.snapshot.context[stepId].output);
        }
      }
    }

    return runWithAny as CustomWorkflowRun;
  },

  watchRun: async (workflowId: string, runId: string, onEvent: (event: VNextWorkflowWatchResult) => void) => {
    const workflow = client.getVNextWorkflow(workflowId);
    await workflow.watch({ runId }, async (record) => {
      console.log("record ---- ", record.payload.workflowState);
      const formattedRecord = {
        ...record,
        payload: {
          ...record.payload,
          currentStep: record.payload.currentStep ? {
            ...record.payload.currentStep,
            output: await presignStepOutput(record.payload.currentStep.output),
          } : undefined,
          workflowState: {
            ...record.payload.workflowState,
            steps: Object.fromEntries(
              await Promise.all(
                Object.entries(record.payload.workflowState.steps).map(async ([key, step]: [string, any]) => [
                  key,
                  {
                    ...step,
                    output: await presignStepOutput(step.output),
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
