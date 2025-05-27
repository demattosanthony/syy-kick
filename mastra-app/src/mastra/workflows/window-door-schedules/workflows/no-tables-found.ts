import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { extractFloorPlanImagesStep } from "../steps/extract-floor-plans.ts";
import { createCsvFromFloorPlanImagesStep } from "../steps/csv-from-floor-plans.ts";

export const noTablesFoundWorkflow = createWorkflow({
  id: "No Tables Found Workflow",
  description:
    "This workflow is used to process the floor plan images found in the PDF",
  inputSchema: z.object({
    extractedPdfImages: z.array(WorkflowRunStepOutputSchema),
    workflowId: z.string(),
    runId: z.string(),
  }),
  outputSchema: z.object({
    csvFile: z.object({
      type: z.literal("file"),
      file: z.object({
        fileKey: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        url: z.string().optional(),
      }),
    }),
  }),
  steps: [extractFloorPlanImagesStep, createCsvFromFloorPlanImagesStep],
})
  .then(extractFloorPlanImagesStep)
  .then(createCsvFromFloorPlanImagesStep)
  .commit();
