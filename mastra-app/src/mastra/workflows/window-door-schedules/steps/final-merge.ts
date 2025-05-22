import { createStep } from "@mastra/core/workflows/vNext";
import { z } from "zod";
import logger from "../../../../logger.ts";
import { windowAndDoorScheduleOutputSchema } from "../schemas.ts";

export const finalMergeStep = createStep({
  id: "finalMergeStep",
  inputSchema: z.object({
    "Tables Found Workflow": z.object({
      csvFile:
        windowAndDoorScheduleOutputSchema.shape.windowAndDoorScheduleCsvFile,
    }),
    "No Tables Found Workflow": z.object({
      csvFile:
        windowAndDoorScheduleOutputSchema.shape.windowAndDoorScheduleCsvFile,
    }),
  }),
  outputSchema: windowAndDoorScheduleOutputSchema,
  execute: async ({ inputData }) => {
    logger.info("Final merge step");

    // The static type of inputData (inferred from the schema above) suggests both keys are always present.
    // However, at runtime, only the key corresponding to the executed branch will contain data.
    // We cast inputData to a type that reflects this runtime reality for safer access.
    const runtimeInputData = inputData as {
      "Tables Found Workflow"?: {
        csvFile: typeof windowAndDoorScheduleOutputSchema.shape.windowAndDoorScheduleCsvFile._type;
      };
      "No Tables Found Workflow"?: {
        csvFile: typeof windowAndDoorScheduleOutputSchema.shape.windowAndDoorScheduleCsvFile._type;
      };
    };

    const csvFile =
      runtimeInputData["Tables Found Workflow"]?.csvFile ||
      runtimeInputData["No Tables Found Workflow"]?.csvFile;

    if (!csvFile) {
      throw new Error(
        "CSV file not found in the output of the executed branches. " +
          "This may indicate an issue with the branch logic or the output schemas of the branched workflows. " +
          "Input received: " +
          JSON.stringify(inputData) // Log actual input for debugging
      );
    }
    return {
      windowAndDoorScheduleCsvFile: csvFile,
    };
  },
});
