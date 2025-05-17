import { createWorkflow, createStep } from "@mastra/core/workflows/vNext";
import { z } from "zod";

import { convertPdfFromS3ToImages } from "../../pdf-to-images.ts";
import { detectObjectsInS3Images } from "../../obj-detection.ts";
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../s3.ts";
import logger from "../../logger.ts";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";
import { classifyImages } from "../../image-classification.ts";
import { performOcrOnS3Images } from "../../llm-ocr.ts";
import { csvWriter } from "../agents/index.ts";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  controlsDrawings: z.object({
    type: z.literal("file"),
    label: z.literal("Controls Drawings PDF"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.literal("application/pdf"),
      fileName: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  totalizedBomCsvFile: z.array(z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      url: z.string().optional(),
    }),
  })),
});

const stepOne = createStep({
  id: "stepOne",
  inputSchema: inputSchema,
  outputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const controlsDrawings = inputData.controlsDrawings;
    const { fileKey } = controlsDrawings.value as WorkflowFile;

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
    imagesWithBomTables: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from a control drawings pdf documentand determine if there are any bill of materials embedded tables on it. 
These tables typically list details about components used in the control system, such as sizes, types, and quantities. The table header should also be Bill of Materials.`,
      schema: z.object({
        hasBomTable: z.boolean(),
      }),
    });

    console.log("Number of images with BOM tables: ", outputs.length);

    return {
      imagesWithBomTables: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  inputSchema: z.object({
    imagesWithBomTables: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { imagesWithBomTables } = inputData;

    const outputs = await detectObjectsInS3Images(
      imagesWithBomTables,
      "Bill of Materials Table",
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
        tableType: "bill of materials",
        columns: ["Tag", "Qty.", "Part No.", "Make"],
        additionalInstructions:
          "Ensure all quantities are properly formatted and any special characters are preserved.",
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
              text: `Your goal is to create a totalzed BOM CSV file that consolidates all bill of materials tables from a controls pdf into a single table.

Steps:
1. Read all the separate BOM tables provided
2. Extract all part numbers and their quantities from each BOM table.
3. Group the part numbers by their make (manufacturer). 
4. Aggregate the quantities for any duplicate parts across all tables.
5. Create a final table with two columns: Part Number and Total Quantity.

CSV Formatting:

| Part Number | Total Quantity |
|-------------|----------------|
| [MAKE 1] |                |
| [Part No. 1] | [Quantity]     |
| [Part No. 2] | [Quantity]     |
| [MAKE 2] |                |
| [Part No. 3] | [Quantity]     |
| ...         | ...            |

Ensure that your final consolidated BOM:
- Includes all unique part numbers from all BOM tables
- Groups part numbers by their make
- Shows the total quantity for each part number
- Is presented in a clear, easily readable format


Remember to use your expertise to provide the most accurate and comprehensive consolidated BOM possible based on the given information..`,
            },
            {
              type: "text",
              text: `Here are the individual BOM tables that you need to consolidate:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
      {
        output: z.object({
          totalizedBomCsvContent: z.string(),
        }),
      }
    );
    const totalizedBomCsvContent = object.totalizedBomCsvContent;

    logger.info(`Totalized BOM: ${totalizedBomCsvContent}`);

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/totalized-bom.csv`;
    const csvFileData = Buffer.from(totalizedBomCsvContent, "utf-8");
    await uploadFileToS3(fileKey, csvFileData, "text/csv");

    const presignedUrlString = await getPresignedUrl(fileKey);

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "totalized-bom.csv",
        url: presignedUrlString,
      },
    };

    return {
      totalizedBomCsvFile: [csvFile],
    };
  },
});

// Build the workflow
const totalizedBomBuilder = createWorkflow({
  id: "Bill of Materials Generator",
  description:
    "This workflow consolidates bill of materials tables that are embedded in controls system drawings",
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

export { totalizedBomBuilder };
