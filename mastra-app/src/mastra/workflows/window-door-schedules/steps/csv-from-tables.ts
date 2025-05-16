import { createStep } from "@mastra/core/workflows/vNext";
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

export const createCsvFromTablesStep = createStep({
  id: "createCsvFromTablesStep",
  inputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
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
    logger.info("Running step five");
    const { markdownFiles, workflowId, runId } = inputData;
    logger.info(`Markdown files: ${markdownFiles.length}`);

    // Load all the markdown files
    const markdownFilesContent = await Promise.all(
      markdownFiles.map(async (mdFile) => {
        const { fileKey } = mdFile.file as WorkflowFile;
        const file = await getFileFromS3(fileKey);
        const markdownData = await file.Body?.transformToString();

        if (!markdownData) {
          throw new Error("No data found");
        }

        return markdownData;
      })
    );

    logger.info(`Markdown files content: ${markdownFilesContent.length}`);
    logger.info(markdownFilesContent[0]);

    const { object } = await csvWriter.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to too read the text extracted from the window and door schedule tables and create a CSV file that contains the data from the tables.

Steps:
1. Analyze all the markdown tables of the window and door schedule tables.
2. Create a single CSV file that contains the data from all the tables.

Example of a single properly formatted line:
"A","8'-0""","2'-4""","18.67"

Quality Control:
- Verify all measurements are properly formatted (X'-Y""")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing
- Check that all fields are properly quoted and escaped`,
            },
            {
              type: "text",
              text: `Here are the individual window and door schedule tables:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
      {
        output: z.object({
          windowAndDoorScheduleCsvContent: z.string(),
        }),
      }
    );
    const windowAndDoorScheduleCsvContent =
      object.windowAndDoorScheduleCsvContent;

    logger.info(
      `Window and Door Schedule CSV: ${windowAndDoorScheduleCsvContent}`
    );

    const fileKey = `workflows/${workflowId}/${runId}/window-door-schedule.csv`;
    const csvFileData = Buffer.from(windowAndDoorScheduleCsvContent, "utf-8");

    // Upload the window and door schedule CSV to S3 and get the presigned url
    await uploadFileToS3(fileKey, csvFileData, "text/csv");
    const presignedUrlString = await getPresignedUrl(fileKey);

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "window-door-schedule.csv",
        url: presignedUrlString,
      },
    };

    return {
      csvFile,
    };
  },
});
