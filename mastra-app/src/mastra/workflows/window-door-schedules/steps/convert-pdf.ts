import { createStep } from "@mastra/core/workflows";
import { z } from "zod";

import {
  WorkflowRunStepOutputSchema,
  type WorkflowFile,
} from "../../../../types.ts";
import logger from "../../../../logger.ts";
import { convertPdfFromS3ToImages } from "../../../../pdf-to-images.ts";
import { windowAndDoorScheduleInputSchema } from "../schemas.ts";

export const convertPdfStep = createStep({
  id: "convertPdfStep",
  description: "Convert all pages of the PDF to images",
  inputSchema: windowAndDoorScheduleInputSchema,
  outputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const architecturalPdf = inputData.architecturalPdf;
    const { fileKey } = architecturalPdf.value as WorkflowFile;

    const uploadedImages = await convertPdfFromS3ToImages(
      fileKey,
      runtimeContext.get("workflowId"),
      runtimeContext.get("runId")
    );
    logger.info(`Returning ${uploadedImages.length} images`);

    return {
      convertedImages: uploadedImages,
    };
  },
});
