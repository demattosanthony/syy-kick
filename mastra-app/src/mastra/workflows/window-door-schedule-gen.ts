// Core dependencies
import { z } from "zod";

// AWS dependencies
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../s3.ts";

// AI/ML dependencies
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
import { performOcrOnS3Images } from "../../llm-ocr.ts";
import { csvWriter } from "../agents/index.ts";

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

const extractPagesWithWindowOrDoorSchedulesStep = createStep({
  id: "extractPagesWithWindowOrDoorSchedulesStep",
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

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/window-door-schedule.csv`;
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
      windowAndDoorScheduleCsvFile: csvFile,
    };
  },
});

const extractFloorPlanImagesStep = createStep({
  id: "extractFloorPlanImagesStep",
  inputSchema: z.object({
    extractedPdfImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    floorPlanImages: z.array(WorkflowRunStepOutputSchema),
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
    };
  },
});

const createCsvFromFloorPlanImagesStep = createStep({
  id: "createCsvFromFloorPlanImagesStep",
  inputSchema: z.object({
    floorPlanImages: z.array(WorkflowRunStepOutputSchema),
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
  execute: async ({ inputData, runtimeContext }) => {
    logger.info("Running step five");
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

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/window-door-schedule.csv`;
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

// Tables found workflow
const tablesFoundWorkflow = createWorkflow({
  id: "Tables Found Workflow",
  description: "This workflow is used to process the tables found in the PDF",
  inputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: finalStepOutputSchema,
  steps: [stepThree, stepFour, stepFive],
})
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

// No tables found workflow
const noTablesFoundWorkflow = createWorkflow({
  id: "No Tables Found Workflow",
  description:
    "This workflow is used to process the floor plan images found in the PDF",
  inputSchema: z.object({
    extractedPdfImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    floorPlanImages: z.array(WorkflowRunStepOutputSchema),
  }),
  steps: [extractFloorPlanImagesStep, createCsvFromFloorPlanImagesStep],
})
  .then(extractFloorPlanImagesStep)
  .then(createCsvFromFloorPlanImagesStep)
  .commit();

// Main workflow
const windowDoorScheduleGen = createWorkflow({
  id: "Window and Door Schedule Generator",
  description:
    "This workflow generates a window and door schedule based on architectural drawings.",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [
    stepOne,
    extractPagesWithWindowOrDoorSchedulesStep,
    extractFloorPlanImagesStep,
    stepThree,
    stepFour,
    stepFive,
  ],
})
  .then(stepOne)
  .then(extractPagesWithWindowOrDoorSchedulesStep)
  .map({
    imagesWithWindowOrDoorSchedules: {
      step: extractPagesWithWindowOrDoorSchedulesStep,
      path: "imagesWithWindowOrDoorSchedules",
    },
    extractedPdfImages: {
      step: stepOne,
      path: "convertedImages",
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
  .commit();

export { windowDoorScheduleGen };
