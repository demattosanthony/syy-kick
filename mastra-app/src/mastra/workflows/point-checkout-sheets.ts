import { z } from "zod";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types";
import { convertPdfFromS3ToImages } from "../../pdf-to-images";
import { createStep, createWorkflow } from "@mastra/core/workflows/vNext";
import { randomUUID } from "node:crypto";
import logger from "../../logger";
import { classifyImages } from "../../image-classification";
import { getFileFromS3, uploadFileToS3, getPresignedUrl } from "../../s3";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

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
  pointCheckoutCsvFiles: z.array(WorkflowRunStepOutputSchema),
});

const stepOne = createStep({
  id: "stepOne",
  description: "Convert the controls drawings PDF to images",
  inputSchema: inputSchema,
  outputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const controlsDrawings = inputData.controlsDrawings;
    const { fileKey } = controlsDrawings.value as WorkflowFile;

    const uploadedImages = await convertPdfFromS3ToImages(
      fileKey,
      randomUUID(),
      randomUUID()
    );
    logger.info(`Returning ${uploadedImages.length} images`);

    return {
      convertedImages: uploadedImages,
    };
  },
});

const stepTwo = createStep({
  id: "stepTwo",
  description: "Find the pages with control wiring diagrams",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithControlWiringDiagrams: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const outputs = await classifyImages(convertedImages, {
      prompt: `Your task is to analyze an image from a control drawings pdf to determine if the page is a controller wiring diagram.

Specifically, look for the following characteristics:

The page will have the words 'Controller Wiring Diagram' at the top center of the page.
The presence of a central controller device or panel (such as a BAS, DDC, PLC, or similar).
Multiple wiring connections shown between the controller and various field devices (inputs/outputs like sensors, relays, switches, actuators, etc.).
Distinct labeling of wiring types (e.g., “Panel Wiring,” “Field Wiring”) and terminal blocks.
Use of electrical or control symbols, such as relays, network switches, or terminal blocks.
A structured layout, often with the controller in the center and field devices on the sides.
Title block or heading referencing terms like “Wiring Diagram,” “Controller,” “Panel Detail,” or “Schematic.”
Legends or notes explaining wire types, line styles, or connection details.
Based on these criteria, state whether the image is a controller wiring diagram and briefly explain your reasoning.

At the bottom right of the page there is section that has the sheet name. Make sure the sheet name include 'Controller Wiring'. If it does not, return false.`,
      schema: z.object({
        hasControlWiringDiagram: z.boolean(),
      }),
    });

    console.log("Number of images with Wiring Diagrams: ", outputs.length);

    return {
      imagesWithControlWiringDiagrams: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  description:
    "Extract controller model number and all points with their channels from control wiring diagrams",
  inputSchema: z.object({
    imagesWithControlWiringDiagrams: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    pointCheckoutCsvFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { imagesWithControlWiringDiagrams } = inputData;

    const controllerDataPromises = imagesWithControlWiringDiagrams.map(
      async (image) => {
        if (!image.file?.fileKey) {
          throw new Error("No image file key found");
        }

        const file = await getFileFromS3(image.file?.fileKey);

        const imageData = await file.Body?.transformToByteArray();

        if (!imageData) {
          throw new Error("No image data found");
        }

        const base64Image = Buffer.from(imageData).toString("base64");

        const result = await generateObject({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this control wiring diagram image and extract the following information:

1. CONTROLLER MODEL NUMBER: Look at the center of the image for the main controller device. The model number is typically displayed prominently on or near the controller unit. Common controller types include BAS, DDC, PLC controllers from manufacturers like Johnson Controls, Honeywell, Siemens, etc.

2. ALL POINTS AND CHANNELS: Examine the entire diagram for all input/output points connected to the controller. For each point, identify:
   - Point name/label (e.g., "Rm101Tmp", "OaRh", "Dss2LkAlm", etc.)
   - Channel/terminal number (e.g., "UIO-1", "DO-Relay-25", "AI-1", "DO-Relay-25", etc.)
   - Point type (AI = Analog Input, AO = Analog Output, DI = Digital Input, DO = Digital Output, etc.)

Look carefully at:
- Terminal blocks and their numbering
- Wire labels and connection points
- Input/output designations on the controller
- Field device connections and their labels
- Any legends or tables that list the points

Be thorough and extract ALL points shown in the diagram, not just a few examples.`,
                },
                {
                  type: "image",
                  image: base64Image,
                  mimeType: "image/png",
                },
              ],
            },
          ],
          model: google("gemini-2.5-pro-preview-05-06", {
            structuredOutputs: true,
          }),
          schema: z.object({
            controllerModelNumber: z.string(),
            points: z.array(
              z.object({
                pointName: z.string(),
                channel: z.string(),
                type: z.string(),
              })
            ),
          }),
        });

        return {
          imageId: image.file?.fileKey || randomUUID(),
          controllerModelNumber: result.object.controllerModelNumber,
          points: result.object.points,
        };
      }
    );

    const controllerData = await Promise.all(controllerDataPromises);

    logger.info(
      `Extracted controller data from ${controllerData.length} images`
    );
    logger.info(
      `Total points found: ${controllerData.reduce((sum, data) => sum + data.points.length, 0)}`
    );

    // Convert controller data to CSV files
    const csvFilePromises = controllerData.map(async (controller) => {
      // Create CSV content
      const csvHeader = "Controller Model Number,Point Name,Channel,Type\n";
      const csvRows = controller.points
        .map((point) => {
          return `"${controller.controllerModelNumber}","${point.pointName}","${point.channel}","${point.type}"`;
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;

      // Upload CSV to S3
      const fileKey = `workflows/${randomUUID()}/${randomUUID()}/point-checkout-${controller.controllerModelNumber}-${controller.imageId.substring(0, 8)}.csv`;
      const csvFileData = Buffer.from(csvContent, "utf-8");
      await uploadFileToS3(fileKey, csvFileData, "text/csv");

      // Get presigned URL
      const presignedUrlString = await getPresignedUrl(fileKey);

      return {
        type: "file" as const,
        file: {
          fileKey,
          mimeType: "text/csv",
          fileName: `point-checkout-${controller.controllerModelNumber}.csv`,
          url: presignedUrlString,
        },
      };
    });

    const pointCheckoutCsvFiles = await Promise.all(csvFilePromises);

    logger.info(`Generated ${pointCheckoutCsvFiles.length} CSV files`);

    return {
      pointCheckoutCsvFiles,
    };
  },
});

// Build the workflow
const pointCheckoutSheetsWorkflow = createWorkflow({
  id: "Checkout Sheets",
  description: "This workflow generates checkout sheets for a control system",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne, stepTwo, stepThree],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .commit();

export { pointCheckoutSheetsWorkflow };
