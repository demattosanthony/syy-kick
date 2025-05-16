import { createStep } from "@mastra/core/workflows/vNext";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { z } from "zod";
import logger from "../../../../logger.ts";
import { performOcrOnS3Images } from "../../../../llm-ocr.ts";

export const performOcrStep = createStep({
  id: "performOcrStep",
  inputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  outputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  execute: async ({ inputData }) => {
    logger.info("Running step four");
    const { croppedImages, workflowId, runId } = inputData;

    const files = await performOcrOnS3Images(
      croppedImages,
      {
        tableType: "window or door schedule",
        columns: ["Item", "Height", "Width", "Area (sq ft)"],
        additionalInstructions:
          'For measurements containing inches ("), add an additional " before the inches: "8\'-0"""',
      },
      workflowId,
      runId
    );

    logger.info(`Returning ${files.length} markdown files`);

    return {
      markdownFiles: files,
      workflowId,
      runId,
    };
  },
});
