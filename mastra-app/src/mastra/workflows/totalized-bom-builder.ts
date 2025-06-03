// Core dependencies
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";
import fs from "fs";

// AI/ML dependencies
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic, type AnthropicProviderOptions } from "@ai-sdk/anthropic";

// Code execution
import { Sandbox } from "@e2b/code-interpreter";
import type { CodeExecutionContext } from "../tools/code-execution.ts";

// Local utilities
import { convertPdfFromS3ToImages } from "../../pdf-to-images.ts";
import { detectObjectsInS3Images } from "../../obj-detection.ts";
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../s3.ts";
import { classifyImages } from "../../image-classification.ts";
import { performOcrOnS3Images } from "../../llm-ocr.ts";
import logger from "../../logger.ts";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";
import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";

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
  totalizedBomExcelFile: z.object({
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
  id: "convertPdfToImages",
  description: "Convert the controls drawings PDF to images",
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

const getProjectNameStep = createStep({
  id: "getProjectName",
  description:
    "Get the project name from the first image of the controls drawings PDF",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    projectName: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    if (convertedImages.length === 0) {
      throw new Error("No images found");
    }

    const firstImage = convertedImages[0];
    if (!firstImage.file || !firstImage.file.fileKey) {
      throw new Error("No file found");
    }

    const { fileKey } = firstImage.file;
    const file = await getFileFromS3(fileKey);
    const imageData = await file.Body?.transformToByteArray();

    if (!imageData) {
      throw new Error("No image data found");
    }

    const imageBase64 = Buffer.from(imageData).toString("base64");

    const { object } = await generateObject({
      model: openai("o4-mini"),
      schema: z.object({
        projectName: z.string(),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to analyze this image and extract the project name from the title of the image. The project name is at the top center of the image.`,
            },
            {
              type: "image",
              image: imageBase64,
              mimeType: "image/png",
            },
          ],
        },
      ],
    });

    return {
      projectName: object.projectName,
    };
  },
});

const stepTwo = createStep({
  id: "classifyImages",
  description: "Classify the images to find the bill of materials tables",
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
  id: "cropImages",
  description: "Crop the images to the bill of materials tables",
  inputSchema: z.object({
    getProjectName: z.object({
      projectName: z.string(),
    }),
    classifyImages: z.object({
      imagesWithBomTables: z.array(WorkflowRunStepOutputSchema),
    }),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { imagesWithBomTables } = inputData.classifyImages;

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
  id: "ocrImages",
  description:
    "Perform OCR on the cropped images to extract the bill of materials tables",
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
        columns: ["Tag", "Qty.", "Part No.", "Description", "Make"],
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
  id: "createTotalizedBomMarkdownFile",
  description: "Create a totalized BOM markdown file",
  inputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    totalizedBomMarkdownFile: z.object({
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

    const { object } = await generateObject({
      model: google("gemini-2.5-pro-preview-05-06"),
      schema: z.object({
        totalizedBomMarkdownContent: z.string(),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your goal is to create a totalized Bill of Materials Markdown file that consolidates all bill of materials tables from a controls pdf into a single markdown table.

Steps:
1. Read all the separate BOM tables provided
2. Extract all part numbers and their quantities from each BOM table.
3. Group the part numbers by their make (manufacturer). 
4. Aggregate the quantities for any duplicate parts across all tables.
5. Create a final table with two columns: Part Number and Total Quantity.

Markdown Formatting:

## TOTALIZED BILL OF MATERIALS

| Part Number | Total Quantity | Description |
|-------------|----------------|-------------|
| [MAKE 1] |                |                |
| [Part No. 1] | [Quantity]     | [Description]     |
| [Part No. 2] | [Quantity]     | [Description]     |
| [MAKE 2] |                |                |
| [Part No. 3] | [Quantity]     | [Description]     |
| ...         | ...            | ...            |

Ensure that your final consolidated BOM:
- Includes all unique part numbers from all BOM tables
- Groups part numbers by their make
- Shows the total quantity for each part number
- Is presented in a clear, easily readable format

Remember to use your expertise to provide the most accurate and comprehensive consolidated BOM possible based on the given information.`,
            },
            {
              type: "text",
              text: `Here are the individual BOM tables that you need to consolidate:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 35000,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    });
    const totalizedBomMarkdownContent = object.totalizedBomMarkdownContent;

    logger.info(`Totalized BOM: ${totalizedBomMarkdownContent}`);

    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/totalized-bom.md`;
    const markdownFileData = Buffer.from(totalizedBomMarkdownContent, "utf-8");
    await uploadFileToS3(fileKey, markdownFileData, "text/markdown");

    const presignedUrlString = await getPresignedUrl(fileKey);

    const markdownFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/markdown",
        fileName: "totalized-bom.md",
        url: presignedUrlString,
      },
    };

    return {
      totalizedBomMarkdownFile: markdownFile,
    };
  },
});

const stepSix = createStep({
  id: "fillOutExcelTemplate",
  description:
    "Fill out the totalized BOM template excel file with the data from the markdown file",
  inputSchema: z.object({
    totalizedBomMarkdownFile: z.object({
      type: z.literal("file"),
      file: z.object({
        fileKey: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        url: z.string().optional(),
      }),
    }),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext, mastra, getStepResult }) => {
    const { totalizedBomMarkdownFile } = inputData;
    const { fileKey } = totalizedBomMarkdownFile.file as WorkflowFile;
    const workflowId = runtimeContext.get("workflowId");
    const runId = runtimeContext.get("runId");

    const projectName = getStepResult(getProjectNameStep).projectName;

    let sandbox: Sandbox | null = null;
    try {
      const file = await getFileFromS3(fileKey);
      const markdownData = await file.Body?.transformToString();

      if (!markdownData) {
        throw new Error("No data found");
      }

      // Create a sandbox for code execution
      sandbox = await Sandbox.create();

      // Get the path to the customer template dynamically
      const localDir = process.cwd();
      const projectRoot = localDir.split("/.mastra")[0];
      logger.info(`Local dir: ${localDir}`);
      const templatePath = `${projectRoot}/customer-templates/Project_BomTracker_05232025.xlsx`;
      logger.info(`Template path: ${templatePath}`);

      // Read the template file as Buffer and use .buffer property to get ArrayBuffer
      const templateFileBuffer = await fs.promises.readFile(templatePath);

      // Add customer template to sandbox - create proper ArrayBuffer from Buffer
      const arrayBuffer = new ArrayBuffer(templateFileBuffer.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      uint8Array.set(templateFileBuffer);

      await sandbox.files.write("/project_bom_tracker.xlsx", arrayBuffer);

      const codeExecutionContext = new RuntimeContext<CodeExecutionContext>();
      codeExecutionContext.set("sandbox", sandbox);

      await mastra.getAgent("coding-agent").generate(
        [
          {
            role: "user",
            content: `Your job is to fill out an excel file with the proper data. The excel file is a template for tracking the bill of materials for a project. You are given the template and the data to populate it.
      
I have placed the Excel file template in the sandbox at the path /project_bom_tracker.xlsx. 

**TASK**: Use Python code to read the Excel file template and populate it with the specific Bill of Materials data provided below, while preserving ALL original formatting of the template.

**REQUIREMENTS**:
1. **Use Python** with libraries like openpyxl or pandas to manipulate the Excel file
2. **PRESERVE ALL ORIGINAL FORMATTING**: Keep all existing colors, fonts, borders, cell styles, and layout intact
3. **Populate with the provided BOM data** (see data table below)
4. **Manufacturer Formatting**: When adding manufacturer names (the rows that have a part number but no quantity value), format them as:
   - **Bold text**
   - **Yellow background highlight** (ONLY for the cell containing the manufacturer name in the first column)
5. **Save the file** at the same path: /project_bom_tracker.xlsx
6. **Project Name**: Fill cell A1 with the project name: "${projectName}"
7. **Description Column Formatting**: Apply "Shrink to Fit" formatting to the description column to ensure text is properly displayed

**DATA TO POPULATE** - Use this exact TOTALIZED BILL OF MATERIALS data:

${markdownData}

**DATA STRUCTURE LOGIC**:
- Rows with empty quantities are **manufacturer names** (should be bold + yellow highlight in first column only)
- Rows with quantities are **part numbers** under that manufacturer
- Follow this hierarchical structure where manufacturer names are category headers followed by their part numbers

**IMPLEMENTATION STEPS**:
1. Use Python to open the Excel file with openpyxl to preserve formatting
2. Set cell A1 to the project name: "${projectName}"
3. Parse the data above to identify manufacturer rows (empty quantity) vs part rows (with quantity)
4. Populate the Excel template with this exact data in the appropriate location
5. Apply bold formatting and yellow background ONLY to the first column cell containing manufacturer names
6. Ensure part number rows maintain clean formatting with quantities
7. Apply "Shrink to Fit" formatting to the description column
8. Save the file preserving all original template structure and formatting

**CRITICAL**: Use the exact data provided above - do not modify or add to it. Preserve all original template formatting, formulas, and visual styling.`,
          },
        ],
        {
          maxSteps: 30,
          runtimeContext: codeExecutionContext,
          providerOptions: {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 35000 },
            } satisfies AnthropicProviderOptions,
          },
        }
      );

      const fileContent = await sandbox.files.read(
        "/project_bom_tracker.xlsx",
        {
          format: "bytes",
        }
      );

      const excelFileKey = `workflows/${workflowId}/${runId}/totalized-bom.xlsx`;

      await uploadFileToS3(
        excelFileKey,
        Buffer.from(fileContent),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      const presignedUrlString = await getPresignedUrl(excelFileKey);

      const excelFile = {
        type: "file" as const,
        file: {
          fileKey: excelFileKey,
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName: "totalized-bom.xlsx",
          url: presignedUrlString,
        },
      };

      return {
        totalizedBomExcelFile: excelFile,
      };
    } catch (error) {
      logger.error("Error in stepSix:", error);
      throw error;
    } finally {
      if (sandbox) {
        sandbox.kill();
      }
    }
  },
});

// Build the workflow
const totalizedBomBuilder = createWorkflow({
  id: "Bill of Materials Generator",
  description:
    "This workflow consolidates bill of materials tables that are embedded in controls system drawings",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [
    stepOne,
    getProjectNameStep,
    stepTwo,
    stepThree,
    stepFour,
    stepFive,
    stepSix,
  ],
})
  .then(stepOne)
  .parallel([getProjectNameStep, stepTwo])
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .then(stepSix)
  .commit();

export { totalizedBomBuilder };
