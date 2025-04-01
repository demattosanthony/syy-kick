import { Attachment, generateObject } from "ai";
import {
  FileData,
  LLMStepConfig,
  ObjectDetectionStepConfig,
  PdfPageExtractStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "./workflows.schemas";
import { MODELS } from "../models";
import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "../../utils";
import { z } from "zod";
import { Jimp } from "jimp";

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";

  // Populate the prompt template and get all the attachments
  let populatedPrompt = stepConfig.promptTemplate;
  let files: FileData[] = [];

  for (const key in inputs) {
    const placeholder = `{input.${key}}`;
    const value = inputs[key];

    // Handle file data
    if (value && value.url && typeof value === "object") {
      files.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && item.url && typeof item === "object") {
          files.push(item);
        }
      }
    } else {
      // Replace all placeholders with the actual values
      populatedPrompt = populatedPrompt.replace(placeholder, String(value));
    }
  }

  const attachments: Attachment[] = files?.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
    name: file.fileName,
  }));

  console.log(`[${step.id}] Starting LLM step execution`);
  console.log(`[${step.id}] Prompt:`, populatedPrompt);
  console.log(`[${step.id}] Attachments Length:`, attachments.length);

  try {
    const { object } = await generateObject({
      model: MODELS[modelName].model,
      schema: stepConfig.outputSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: populatedPrompt,
            },
            ...(attachments.map((attachment) => ({
              type: "file",
              data: attachment.url,
              mimeType: attachment.contentType,
            })) as any),
          ],
        },
      ],
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);

    console.log(`[${step.id}] LLM step completed successfully`);
    return validatedOutput.data as StepOutputData;
  } catch (error) {
    console.error(`[${step.id}] Error during LLM step execution:`, error);
    throw error; // Re-throw the error after logging
  }
};

export const executePdfPageExtractionStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as PdfPageExtractStepConfig["config"];
  console.log(`[${step.id}] Starting PDF Page Extraction step execution`);

  // 1. Resolve PDF FileData and Page Number from state
  const pageNumber = utils.getDataSourceValue(
    state,
    stepConfig.pageNumberSource
  ) as number | undefined;
  const pdfFileInfo = utils.getDataSourceValue(
    state,
    stepConfig.pdfDataSource
  ) as FileData | undefined;

  // 2. Validate inputs
  if (
    !pdfFileInfo ||
    typeof pdfFileInfo !== "object" ||
    !pdfFileInfo.url ||
    !pdfFileInfo.fileName
  ) {
    throw new Error(
      `Could not resolve valid PDF FileData (with url) at source '${stepConfig.pdfDataSource}' for step ${step.id}.`
    );
  }
  if (
    typeof pageNumber !== "number" ||
    !Number.isInteger(pageNumber) ||
    pageNumber <= 0
  ) {
    throw new Error(
      `Invalid or missing page number at source '${stepConfig.pageNumberSource}' for step ${step.id}. Received: ${pageNumber}`
    );
  }

  // Load the original PDF
  const pdfDoc = await PDFDocument.load(pdfFileInfo.url);

  // Create a new pdf doc
  const newPdfDoc = await PDFDocument.create();

  // Copy the specific page
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]); // PDF pages are 0-indexed
  newPdfDoc.addPage(copiedPage);

  // Save the new PDF
  const newPdfBytes = await newPdfDoc.save();

  // Use the full extracted PDF page for the image conversion
  const pageImage = await getPdfPageAsImage(newPdfBytes, 1, {
    format: "png",
    dpi: 150, // Higher DPI for better quality
    maxDimension: 8000,
  });

  // Write the image to a file
  const imageFilePath = `./ocr-results/page_${pageNumber}.png`;
  await Bun.write(imageFilePath, Buffer.from(pageImage, "base64"));

  return {
    imageBase64: pageImage,
    pageNumber,
  };
};

export const executeObjectDetectionStep: StepExecutorFunction = async ({
  step,
  state,
  inputs,
  workflow,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as ObjectDetectionStepConfig["config"];
  console.log(`[${step.id}] Starting Object Detection step execution`);

  // 1. Resolve image FileData from state
  const imageFileData = utils.getDataSourceValue(
    state,
    stepConfig.imageDataSource
  ) as string | undefined;
  const model = MODELS[stepConfig.model].model;
  const prompt = stepConfig.promptTemplate;

  // 2. Validate inputs
  if (!imageFileData) {
    throw new Error(
      `Could not resolve valid image FileData (with url) at source '${stepConfig.imageDataSource}' for step ${step.id}.`
    );
  }

  // 3. Run the object detection model
  const { object } = await generateObject({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: imageFileData!,
            mimeType: "image/png",
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    schema: z.object({
      bounding_boxes: z.array(
        z.object({
          box_2d: z.array(z.number()).length(4),
          label: z.string(),
        })
      ),
    }),
  });

  console.log(object.bounding_boxes);

  // Load the image
  const image = await Jimp.read(Buffer.from(imageFileData, "base64"));
  const { width, height } = image.bitmap;
  let index = 0;

  // Save all bounding boxes as separate images, base64 strings
  let boundingBoxImages: FileData[] = [];

  for (const box of object.bounding_boxes) {
    const [y_min, x_min, y_max, x_max] = box.box_2d;
    const label = box.label;

    // Convert normalized [0..1000] → actual pixel coordinates
    const x1 = Math.round((x_min / 1000) * width);
    const y1 = Math.round((y_min / 1000) * height);
    const x2 = Math.round((x_max / 1000) * width);
    const y2 = Math.round((y_max / 1000) * height);

    // Extract the bounding box as a new image
    const boxWidth = x2 - x1;
    const boxHeight = y2 - y1;

    // Clone the original image and crop to the bounding box
    const boxImage = image.clone().crop({
      h: boxHeight,
      w: boxWidth,
      x: x1,
      y: y1,
    });

    // Get base64 representation
    const boxImageBuffer = await boxImage.getBuffer("image/jpeg");
    const boxImageBase64 = boxImageBuffer.toString("base64");

    boundingBoxImages.push({
      url: boxImageBase64,
      fileName: `box_${index}_${label}.jpeg`,
      mimeType: "image/jpeg",
    });

    // Create a sanitized label for filename (replace spaces and special chars)
    // const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    // // Save the cropped image
    // await boxImage
    //   .write(`./ocr-results/box_${index}_${safeLabel}.jpeg`)
    //   .then(() => console.log(`Saved bounding box ${index}: ${label}`))
    //   .catch((err) => console.error(`Error saving box ${index}:`, err));
    index += 1;
  }

  return {
    screenshots: boundingBoxImages,
  };
};

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
stepExecutorRegistry.set("object_detection", executeObjectDetectionStep);
