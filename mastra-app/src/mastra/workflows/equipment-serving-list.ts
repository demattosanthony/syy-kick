import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";

import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";
import logger from "../../logger.ts";
import { convertPdfFromS3ToImages } from "../../pdf-to-images.ts";
import { classifyImages } from "../../image-classification.ts";
import { detectObjectsInS3Images } from "../../obj-detection.ts";
import { performOcrOnS3Images } from "../../llm-ocr.ts";
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../s3.ts";
import { csvWriter } from "../agents/index.ts";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  mechanicalDrawings: z.object({
    type: z.literal("file"),
    label: z.literal("Mechanical Drawings PDF"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.literal("application/pdf"),
      fileName: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  equipmentServingListCsvFile: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      url: z.string().optional(),
    }),
  }),
});

const stepOne = createStep({
  id: "stepOne",
  description: "Convert all pages of the PDF to images",
  inputSchema: inputSchema,
  outputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const mechanicalDrawings = inputData.mechanicalDrawings;
    const { fileKey } = mechanicalDrawings.value as WorkflowFile;

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
  description: "Classify the images to find the mechanical schedules",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithMechanicalSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from a mechanical drawings pdf document and determine if there are any mechanical schedules or equipment lists embedded as tables.
These schedules typically list details about mechanical equipment used in the building, such as AHUs, RTUs, VAVs, pumps, etc. The table header may be labeled as "Mechanical Equipment Schedule", "HVAC Equipment Schedule", "Equipment Schedule" or similar. Look for tables that show equipment types, sizes, capacities, locations and other technical specifications.`,
      schema: z.object({
        hasMechanicalSchedule: z.boolean(),
      }),
    });

    console.log(
      "Number of images with equipment serving lists: ",
      outputs.length
    );

    return {
      imagesWithMechanicalSchedules: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  description: "Detect the mechanical equipment schedule tables",
  inputSchema: z.object({
    imagesWithMechanicalSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { imagesWithMechanicalSchedules } = inputData;

    const outputs = await detectObjectsInS3Images(
      imagesWithMechanicalSchedules,
      "Mechanical Equipment Schedule Table",
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
  description: "Perform OCR on the cropped images to get the markdown",
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
        tableType: "mechanical equipment schedule",
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
  description: "Generate the equipment serving list CSV",
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
              text: `Your task is to analyze the mechanical schedule markdown tables and extract the data from them.

Steps:
1. Analyze the mechanical schedule markdown tables.
2. Extract the data from the tables and save it as a CSV file.

Output Format:
Generate a CSV artifact with proper escaping using the following structure:

Example of correct CSV formatting:
"Equipment ID","Location,Service Area(s)"
"AHU-1","Mechanical Room 101","1st Floor Offices","2nd Floor Laboratories"
"DOAS-1","Roof","3rd Floor [NEEDS CONFIRMATION]"`,
            },
            {
              type: "text",
              text: `Here are the individual mechanical schedule tables:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
      {
        output: z.object({
          equipmentServingListCsvContent: z.string(),
        }),
      }
    );
    const equipmentServingListCsvContent =
      object.equipmentServingListCsvContent;

    logger.info(
      `Equipment Serving List CSV: ${equipmentServingListCsvContent}`
    );

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/equipment-serving-list.csv`;
    const csvFileData = Buffer.from(equipmentServingListCsvContent, "utf-8");

    // Upload the equipment serving list CSV to S3 and get the presigned url
    await uploadFileToS3(fileKey, csvFileData, "text/csv");
    const presignedUrlString = await getPresignedUrl(fileKey);

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "equipment-serving-list.csv",
        url: presignedUrlString,
      },
    };

    return {
      equipmentServingListCsvFile: csvFile,
    };
  },
});

const equipmentServingListWorkflow = createWorkflow({
  id: "Equipment Serving List",
  description:
    "This workflow generates a equipment serving list based on mechanical drawings.",
  inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne, stepTwo, stepThree, stepFour, stepFive],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

export { equipmentServingListWorkflow };
