import { createWorkflow } from "@mastra/core/workflows/vNext";
import { z } from "zod";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import { extractTablesStep } from "../steps/extract-tables.ts";
import { performOcrStep } from "../steps/perform-ocr.ts";
import { createCsvFromTablesStep } from "../steps/csv-from-tables.ts";

export const tablesFoundWorkflow = createWorkflow({
  id: "Tables Found Workflow",
  description: "This workflow is used to process the tables found in the PDF",
  inputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
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
  steps: [extractTablesStep, performOcrStep, createCsvFromTablesStep],
})
  .then(extractTablesStep)
  .then(performOcrStep)
  .then(createCsvFromTablesStep)
  .commit();
