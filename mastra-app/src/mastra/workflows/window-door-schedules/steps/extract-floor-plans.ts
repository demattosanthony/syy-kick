import { createStep } from "@mastra/core/workflows/vNext";
import { z } from "zod";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { classifyImages } from "../../../../image-classification.ts";
import logger from "../../../../logger.ts";

export const extractFloorPlanImagesStep = createStep({
  id: "extractFloorPlanImagesStep",
  inputSchema: z.object({
    extractedPdfImages: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  outputSchema: z.object({
    floorPlanImages: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  execute: async ({ inputData }) => {
    logger.info("No window or door schedules found in the provided PDF");

    // Find all the images all the architectural floor plans drawings
    const floorPlanImages = await classifyImages(inputData.extractedPdfImages, {
      prompt: `Your task is to analyze an image from a architectural drawings pdf document and determine if this sheet is an architectural floor plan.
The floor plan sheet is a drawing that shows the layout of the building, including the location of walls, windows, doors, and other features.`,
      schema: z.object({
        hasFloorPlan: z.boolean(),
      }),
    });

    return {
      floorPlanImages,
      workflowId: inputData.workflowId,
      runId: inputData.runId,
    };
  },
});
