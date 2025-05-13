// Core dependencies
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

// AWS dependencies
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../../s3.ts";

// AI/ML dependencies
import { generateObject } from "ai";
import { classifyImages } from "../../image-classification.ts";
import { detectObjectsInS3Images } from "../../obj-detection.ts";

// Workflow dependencies
import { createWorkflow, createStep } from "@mastra/core/workflows/vNext";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";

// Utilities
import { convertPdfFromS3ToImages } from "../../pdf-to-images.ts";
import logger from "../../logger.ts";
import { google } from "@ai-sdk/google";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { performOcrOnS3Images } from "../../llm-ocr.ts";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  architecturalPdf: z.object({
    type: z.literal("file"),
    label: z.literal("Architectural PDF"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.literal("application/pdf"),
      fileName: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  windowAndDoorScheduleCsvFile: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      fileUrl: z.string().optional(),
    }),
  }),
});

const stepOne = createStep({
  id: "stepOne",
  inputSchema: inputSchema,
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

const stepTwo = createStep({
  id: "stepTwo",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from a architectural drawings pdf documentand determine if there are any window or door schedules embedded tables on it. 
These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities. The table header will be something like "Window Schedule" or "Door Schedule".`,
      schema: z.object({
        hasWindowOrDoorSchedule: z.boolean(),
      }),
    });

    console.log(
      "Number of images with window or door schedules: ",
      outputs.length
    );

    return {
      imagesWithWindowOrDoorSchedules: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  inputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { imagesWithWindowOrDoorSchedules } = inputData;

    const outputs = await detectObjectsInS3Images(
      imagesWithWindowOrDoorSchedules,
      "Window or Door Schedule Table",
      runtimeContext.get("workflowId"),
      runtimeContext.get("runId")
    );

    logger.info(`Flattened ${outputs.length} cropped images`);

    return {
      croppedImages: outputs,
    };
  },
});

const stepFour = createStep({
  id: "stepFour",
  inputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    logger.info("Running step four");
    const { croppedImages } = inputData;

    const files = await performOcrOnS3Images(
      croppedImages,
      {
        tableType: "window or door schedule",
        columns: ["Item", "Height", "Width", "Area (sq ft)"],
        additionalInstructions:
          'For measurements containing inches ("), add an additional " before the inches: "8\'-0"""',
      },
      runtimeContext.get("workflowId"),
      runtimeContext.get("runId")
    );

    logger.info(`Returning ${files.length} markdown files`);

    return {
      markdownFiles: files,
    };
  },
});

const stepFive = createStep({
  id: "stepFive",
  inputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext }) => {
    logger.info("Running step five");
    const { markdownFiles } = inputData;
    logger.info(`Markdown files: ${markdownFiles.length}`);

    // Load all the markdown files
    const markdownFilesContent = await Promise.all(
      markdownFiles.map(async (mdFile) => {
        const file = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: mdFile.file?.fileKey,
          })
        );
        const markdownData = await file.Body?.transformToString();

        if (!markdownData) {
          throw new Error("No data found");
        }

        return markdownData;
      })
    );

    logger.info(`Markdown files content: ${markdownFilesContent.length}`);
    logger.info(markdownFilesContent[0]);

    // Use llm to create a totalized BOM from the ocr results
    const totalizedBom = await generateObject({
      model: google("gemini-2.5-pro-exp-03-25"),
      schema: z.object({
        windowAndDoorScheduleCsvContent: z.string(),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to too read the text extracted from the window and door schedule tables and create a CSV file that contains the data from the tables.

Steps:
1. Analyze the cropped images of the window and door schedule tables.
2. Extract the data from the tables and save it as a CSV file.

Output Format:
Generate a CSV artifact with proper escaping using the following structure:

Example of correct CSV formatting:
"WINDOW SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"A","8'-0""","2'-4""","18.67"
"B","4'-8""","2'-8""","12.44"

"DOOR SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"01A","8'-0""","3'-0""","24.00"
"01B","8'-0""","3'-0""","24.00"

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"

Example of a single properly formatted line:
"A","8'-0""","2'-4""","18.67"

Quality Control:
- Verify all measurements are properly formatted (X'-Y""")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing
- Check that all fields are properly quoted and escaped

Return only the final CSV in the specified format, without any additional commentary or markup.

Do not make up any information. Only include information that is present in the cropped images. If you are unsure about a measurement or detail, indicate it as "unknown" in the output. Do not attempt to fill in gaps with assumptions or estimates.`,
            },
            {
              type: "text",
              text: `Here are the individual BOM tables that you need to consolidate:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
    });
    logger.info(
      `Totalized BOM: ${totalizedBom.object.windowAndDoorScheduleCsvContent}`
    );

    const windowAndDoorScheduleCsvContent =
      totalizedBom.object.windowAndDoorScheduleCsvContent;

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/window-door-schedule.csv`;

    // Upload the totalized BOM CSV to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
        Body: Buffer.from(windowAndDoorScheduleCsvContent, "utf-8"),
        ContentType: "text/csv",
      })
    );

    // Get the presigned url for the totalized BOM CSV
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
    });
    const presignedUrlString = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "window-door-schedule.csv",
        fileUrl: presignedUrlString,
      },
    };

    return {
      windowAndDoorScheduleCsvFile: csvFile,
    };
  },
});

// Build the workflow
const windowDoorScheduleGen = createWorkflow({
  id: "window-door-schedule-gen",
  description:
    "Generate a window and door schedule CSV file from an architectural PDF",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne, stepTwo, stepThree, stepFour, stepFive],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

export { windowDoorScheduleGen };
