// Core dependencies
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { z } from "zod";
import fs from "fs";

// AI/ML dependencies
import { generateObject } from "ai";
import { type AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { google, type GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";

// Code execution
import { Sandbox } from "@e2b/code-interpreter";
import type { CodeExecutionContext } from "../tools/code-execution.ts";

// Utils
import { convertPdfFromS3ToImages } from "../../pdf-to-images.ts";
import { detectObjectsInS3Images } from "../../obj-detection.ts";
import { getFileFromS3, getPresignedUrl, uploadFileToS3 } from "../../s3.ts";
import { classifyImages } from "../../image-classification.ts";
import logger from "../../logger.ts";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowFile,
} from "../../types.ts";
import {
  windowAndDoorScheduleInputSchema,
} from "./window-door-schedules/schemas.ts";
import { openai } from "@ai-sdk/openai";

// Update the output schema for Excel file instead of CSV
const finalStepOutputSchema = z.object({
  windowAndDoorScheduleExcelFile: z.object({
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
  description: "Convert the architectural PDF to images",
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
    logger.info(`Converted PDF to ${uploadedImages.length} images`);

    return {
      convertedImages: uploadedImages,
    };
  },
});

const stepTwo = createStep({
  id: "classifyImages",
  description: "Classify the images to find window and door schedule tables",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithScheduleTables: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from an architectural PDF document and determine if there are any window and door schedule tables on it. 
These tables typically contain information about exterior windows and doors including their dimensions (width and height), identification numbers, and types. 
Look for tables with headers like "Window Schedule", "Door Schedule", "Window and Door Schedule", or similar variations that contain dimensional data for exterior openings.`,
      schema: z.object({
        hasWindowDoorScheduleTable: z.boolean(),
      }),
    });

    logger.info(`Number of images with window/door schedule tables: ${outputs.length}`);

    return {
      imagesWithScheduleTables: outputs,
    };
  },
});

const stepThree = createStep({
  id: "cropImages",
  description: "Crop the images to the window and door schedule tables",
  inputSchema: z.object({
    imagesWithScheduleTables: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { imagesWithScheduleTables } = inputData;

    const outputs = await detectObjectsInS3Images(
      imagesWithScheduleTables,
      "Window Door Schedule Table",
      runtimeContext.get("workflowId"),
      runtimeContext.get("runId")
    );

    logger.info(`Cropped ${outputs.length} schedule table images`);

    return {
      croppedImages: outputs,
    };
  },
});

const stepFour = createStep({
  id: "extractTableData",
  description: "Extract window and door data from the cropped table images",
  inputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    logger.info("Extracting table data from cropped images");
    const { croppedImages } = inputData;

    const markdownFiles = await Promise.all(
      croppedImages.map(async (image, index) => {
        const { fileKey } = image.file as WorkflowFile;
        const file = await getFileFromS3(fileKey);
        const imageData = await file.Body?.transformToByteArray();

        if (!imageData) {
          throw new Error("No image data found");
        }

        const imageBase64 = Buffer.from(imageData).toString("base64");

        const { object } = await generateObject({
          // model: google("gemini-2.5-pro-preview-05-06"),
          model: openai("o4-mini"),
          schema: z.object({
            markdownTable: z.string(),
          }),
          abortSignal: AbortSignal.timeout(300000), // 5 minutes
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Your task is to extract data from a window and door schedule table and convert it to markdown format.

IMPORTANT FORMATTING RULES:
- For measurements with feet and inches: Use single quote (') for feet and double quotes (") for inches
- When there are inches, add an extra backslash before the quotes: 8\\'-0\\"
- Only extract EXTERIOR windows and doors
- Return ONLY the markdown table, no other text

Required markdown format:
| id | width | height | type | confidence |
|----|-------|--------|------|------------|
| [ID] | [WIDTH] | [HEIGHT] | [TYPE] | [CONFIDENCE] |

Column descriptions:
- id: The identifier/mark for each window or door from the table
- width: Width with proper formatting (e.g., 8\\'-0\\", 6\\'-0\\")  
- height: Height with proper formatting (e.g., 8\\'-0\\", 6\\'-8\\")
- type: "W" for window, "D" for exterior door only
- confidence: Your confidence level from 0-10 (0=verify needed, 10=fully confident)

Focus on exterior openings only. Ignore interior doors and any non-opening elements.`,
                },
                {
                  type: "image",
                  image: imageBase64,
                  mimeType: "image/png",
                },
              ],
            },
          ],
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 32768,
              },
            } satisfies GoogleGenerativeAIProviderOptions,
          },
        });

        const markdownContent = object.markdownTable;
        logger.info(`Extracted table data: ${markdownContent.substring(0, 200)}...`);

        const markdownFileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/extracted-table-${index}.md`;
        const markdownFileData = Buffer.from(markdownContent, "utf-8");
        await uploadFileToS3(markdownFileKey, markdownFileData, "text/markdown");

        const presignedUrlString = await getPresignedUrl(markdownFileKey);

        return {
          type: "file" as const,
          file: {
            fileKey: markdownFileKey,
            mimeType: "text/markdown",
            fileName: `extracted-table-${index}.md`,
            url: presignedUrlString,
          },
        };
      })
    );

    logger.info(`Generated ${markdownFiles.length} markdown files`);

    return {
      markdownFiles,
    };
  },
});

const stepFive = createStep({
  id: "fillExcelTemplate",
  description: "Fill out the window and door schedule Excel template",
  inputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext, mastra }) => {
    logger.info("Filling Excel template with extracted data");
    const { markdownFiles } = inputData;
    const workflowId = runtimeContext.get("workflowId");
    const runId = runtimeContext.get("runId");

    // Load all markdown files
    const markdownFilesContent = await Promise.all(
      markdownFiles.map(async (mdFile) => {
        const { fileKey } = mdFile.file as WorkflowFile;
        const file = await getFileFromS3(fileKey);
        const markdownData = await file.Body?.transformToString();

        if (!markdownData) {
          throw new Error("No markdown data found");
        }

        return markdownData;
      })
    );

    logger.info(`Loaded ${markdownFilesContent.length} markdown files`);

    let sandbox: Sandbox | null = null;
    try {
      // Create a sandbox for code execution
      sandbox = await Sandbox.create();

      // Get the path to the customer template
      const localDir = process.cwd();
      const projectRoot = localDir.split("/.mastra")[0];
      const templatePath = `${projectRoot}/customer-templates/window-door-schedule.xlsx`;
      logger.info(`Template path: ${templatePath}`);

      // Read the template file
      const templateFileBuffer = await fs.promises.readFile(templatePath);

      // Add template to sandbox
      const arrayBuffer = new ArrayBuffer(templateFileBuffer.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      uint8Array.set(templateFileBuffer);

      await sandbox.files.write("/window_door_schedule.xlsx", arrayBuffer);

      const codeExecutionContext = new RuntimeContext<CodeExecutionContext>();
      codeExecutionContext.set("sandbox", sandbox);

      await mastra.getAgent("coding-agent").generate(
        [
          {
            role: "user",
            content: `Your job is to fill out an Excel template with window and door schedule data. The Excel file template is at /window_door_schedule.xlsx.

**TASK**: Use Python to read the Excel template and populate it with the window and door data provided below, while preserving ALL original formatting.

**REQUIREMENTS**:
1. **Use Python** with openpyxl to manipulate the Excel file
2. **PRESERVE ALL ORIGINAL FORMATTING**: Keep existing colors, fonts, borders, cell styles, and layout
3. **Group data**: First all windows (type "W"), then all doors (type "D")
4. **Add section separators**: Insert a blank row between windows and doors sections
5. **Calculate area**: For each row, calculate area = width × height (convert measurements to decimal feet first)
6. **Handle measurements**: Convert measurements like "8\\'-0\\"" to decimal feet (8.0 in this case)
7. **Column mapping**: 
   - id → id column
   - width → width column (keep original format like "8\\'-0\\"")
   - height → height column (keep original format)
   - type → type column ("W" for windows, "D" for doors)
   - area → area column (calculated as width × height in square feet)
   - confidence → confidence column
8. **Confidence color coding**: Apply background and font colors based on confidence values (0-10):
   - 0: Background #fcacac, Font #db0000
   - 1: Background #ffd1d1, Font #eb0000
   - 2: Background #ffe0e0, Font #ff0000
   - 3: Background #ffb994, Font #bf4200
   - 4: Background #fccbb1, Font #e04e00
   - 5: Background #ffe3d4, Font #ff5900
   - 6: Background #ffc56e, Font #b06a00
   - 7: Background #ffd18c, Font #d47f00
   - 8: Background #ffe1b5, Font #ff9900
   - 9: Background #f1ffba, Font #5a8200
   - 10: Background #03c700, Font #ffffff
9. **Add subtotals**: 
   - Add a subtotal row for windows section (sum of all window areas)
   - Add a subtotal row for doors section (sum of all door areas)
   - Add a grand total row at the end (sum of all areas)
10. **Save the file** at the same path: /window_door_schedule.xlsx

**DATA TO PROCESS**:
${markdownFilesContent.join("\n\n---\n\n")}

**IMPLEMENTATION STEPS**:
1. Parse all markdown tables to extract window and door data
2. Convert measurements to decimal feet for area calculations
3. Group windows first, then doors
4. Calculate area for each item
5. Fill the Excel template with the processed data
6. Apply confidence color coding to the confidence column cells
7. Add section separators and subtotals
8. Preserve all original formatting
9. Save the file

**CRITICAL FORMATTING NOTES**: 
- Convert measurements like "8\\'-6\\"" to decimal feet (8.5) for area calculation
- Keep original measurement format in width/height columns
- Group windows before doors in the output
- Apply confidence colors only to the confidence column cells
- Add proper subtotal rows with formulas if possible
- Preserve all template formatting and structure

**PYTHON EXAMPLE FOR CONFIDENCE COLORS**:
\`\`\`python
from openpyxl.styles import PatternFill, Font

# Confidence color mapping
confidence_colors = {
    0: {"bg": "fcacac", "font": "db0000"},
    1: {"bg": "ffd1d1", "font": "eb0000"},
    2: {"bg": "ffe0e0", "font": "ff0000"},
    3: {"bg": "ffb994", "font": "bf4200"},
    4: {"bg": "fccbb1", "font": "e04e00"},
    5: {"bg": "ffe3d4", "font": "ff5900"},
    6: {"bg": "ffc56e", "font": "b06a00"},
    7: {"bg": "ffd18c", "font": "d47f00"},
    8: {"bg": "ffe1b5", "font": "ff9900"},
    9: {"bg": "f1ffba", "font": "5a8200"},
    10: {"bg": "03c700", "font": "ffffff"}
}

# Apply to confidence cell
if confidence_value in confidence_colors:
    cell.fill = PatternFill(start_color=confidence_colors[confidence_value]["bg"], 
                           end_color=confidence_colors[confidence_value]["bg"], 
                           fill_type="solid")
    cell.font = Font(color=confidence_colors[confidence_value]["font"])
\`\`\``,
          },
        ],
        {
          maxSteps: 30,
          runtimeContext: codeExecutionContext,
          providerOptions: {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 32768 },
            } satisfies AnthropicProviderOptions,
          },
        }
      );

      const fileContent = await sandbox.files.read("/window_door_schedule.xlsx", {
        format: "bytes",
      });

      const excelFileKey = `workflows/${workflowId}/${runId}/window-door-schedule.xlsx`;

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
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName: "window-door-schedule.xlsx",
          url: presignedUrlString,
        },
      };

      logger.info("Successfully created window and door schedule Excel file with confidence colors and subtotals");

      return {
        windowAndDoorScheduleExcelFile: excelFile,
      };
    } catch (error) {
      logger.error("Error in stepFive:", error);
      throw error;
    } finally {
      if (sandbox) {
        sandbox.kill();
      }
    }
  },
});

// Build the workflow
const windowDoorSchedulesTables = createWorkflow({
  id: "Window and Door Schedules Tables",
  description: "This workflow extracts window and door schedule tables from architectural drawings and creates a consolidated Excel file",
  inputSchema: windowAndDoorScheduleInputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne, stepTwo, stepThree, stepFour, stepFive],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

export { windowDoorSchedulesTables };
