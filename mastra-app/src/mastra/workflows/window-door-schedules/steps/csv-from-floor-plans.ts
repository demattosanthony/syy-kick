import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { WorkflowRunStepOutputSchema } from "../../../../types.ts";
import logger from "../../../../logger.ts";
import {
  getFileFromS3,
  uploadFileToS3,
  getPresignedUrl,
} from "../../../../s3.ts";
import { csvWriter } from "../../../agents/index.ts";
import { type WorkflowFile } from "../../../../types.ts";

export const createCsvFromFloorPlanImagesStep = createStep({
  id: "createCsvFromFloorPlanImagesStep",
  inputSchema: z.object({
    floorPlanImages: z.array(WorkflowRunStepOutputSchema),
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
  execute: async ({ inputData }) => {
    logger.info("Running step createCsvFromFloorPlanImagesStep");
    const { floorPlanImages } = inputData;

    if (floorPlanImages.length === 0) {
      throw new Error("No floor plan images found");
    }

    // Get all the images from s3
    const floorPlanImagesData = await Promise.all(
      floorPlanImages.map(async (image) => {
        const { fileKey } = image.file as WorkflowFile;
        const file = await getFileFromS3(fileKey);
        const imageData = await file.Body?.transformToByteArray();

        if (!imageData) {
          throw new Error("No data found");
        }

        return Buffer.from(imageData).toString("base64");
      })
    );

    // Have LLM create a CSV from the floor plan images
    const { object } = await csvWriter.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to read the architectural floor plan images to create a CSV file that contains a window and door schedule. In order to do this you need to identify the windows and doors in the images, where they are located and their dimensions.

This is for california title 24 energy code compliance. So we need to identify the windows and doors in the images, where they are located and their dimensions. You only need to focus on conditioned spaces.

Once you have identified the window and door schedule tables, you need to create a CSV file that contains the data from the tables.

## CSV File formatting to follow:
Window Schedule
Window Tag, Width, Height, Area (sq ft)

Door Schedule
Door Tag, Width, Height, Area (sq ft)

You can use the space names and location to give the window and door tags if they are not already named.

Quality Control:
- Verify all measurements are properly formatted (X'-Y""")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing
- Check that all fields are properly quoted and escaped`,
            },
            ...floorPlanImagesData.map((imageData) => ({
              type: "image" as const,
              image: imageData,
              mimeType: "image/png",
            })),
          ],
        },
      ],
      {
        output: z.object({
          floorPlanCsvContent: z.string(),
        }),
      }
    );

    const floorPlanCsvContent = object.floorPlanCsvContent;

    const fileKey = `workflows/${inputData.workflowId}/${inputData.runId}/floor-plan.csv`;
    const csvFileData = Buffer.from(floorPlanCsvContent, "utf-8");

    // Upload the CSV to S3 and get the presigned url
    await uploadFileToS3(fileKey, csvFileData, "text/csv");
    const presignedUrlString = await getPresignedUrl(fileKey);

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "floor-plan.csv",
        url: presignedUrlString,
      },
    };

    return {
      csvFile,
    };
  },
});
