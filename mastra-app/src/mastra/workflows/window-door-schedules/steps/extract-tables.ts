import { createStep } from "@mastra/core/workflows";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { z } from "zod";
import logger from "../../../../logger.ts";
import { detectObjectsInS3Images } from "../../../../obj-detection.ts";

export const extractTablesStep = createStep({
  id: "extractTablesStep",
  inputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { imagesWithWindowOrDoorSchedules, workflowId, runId } = inputData;

    const outputs = await detectObjectsInS3Images(
      imagesWithWindowOrDoorSchedules,
      "Window or Door Schedule Table",
      workflowId,
      runId
    );

    logger.info(`Flattened ${outputs.length} cropped images`);

    return {
      croppedImages: outputs,
      workflowId,
      runId,
    };
  },
});
