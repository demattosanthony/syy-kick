import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import {
  convertPdfStep,
  finalMergeStep,
  findSchedulesPagesStep,
} from "../steps/index.ts";
import {
  windowAndDoorScheduleInputSchema,
  windowAndDoorScheduleOutputSchema,
} from "../schemas.ts";
import { tablesFoundWorkflow } from "./tables-found.ts";
import { noTablesFoundWorkflow } from "./no-tables-found.ts";

export const windowDoorScheduleGen = createWorkflow({
  id: "Window and Door Schedule Generator",
  description:
    "This workflow generates a window and door schedule based on architectural drawings.",
  inputSchema: windowAndDoorScheduleInputSchema,
  outputSchema: windowAndDoorScheduleOutputSchema,
  steps: [convertPdfStep, findSchedulesPagesStep, finalMergeStep],
})
  .then(convertPdfStep)
  .then(findSchedulesPagesStep)
  .map({
    imagesWithWindowOrDoorSchedules: {
      step: findSchedulesPagesStep,
      path: "imagesWithWindowOrDoorSchedules",
    },
    extractedPdfImages: {
      step: convertPdfStep,
      path: "convertedImages",
    },
    workflowId: {
      runtimeContextPath: "workflowId",
      schema: z.string(),
    },
    runId: {
      runtimeContextPath: "runId",
      schema: z.string(),
    },
  })
  .branch([
    [
      async ({ inputData }) =>
        inputData.imagesWithWindowOrDoorSchedules.length === 0,
      noTablesFoundWorkflow,
    ],
    [
      async ({ inputData }) =>
        inputData.imagesWithWindowOrDoorSchedules.length > 0,
      tablesFoundWorkflow,
    ],
  ])
  .then(finalMergeStep)
  .commit();
