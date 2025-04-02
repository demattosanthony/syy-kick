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
  inputs,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as LLMStepConfig["config"];
  const modelName = stepConfig.modelName || "claude-3.5-sonnet";
  let populatedPrompt = stepConfig.promptTemplate;
  const files: FileData[] = [];

  // Process inputs: replace placeholders or collect files
  for (const [key, value] of Object.entries(inputs || {})) {
    const placeholder = `{input.${key}}`;
    if (value && typeof value === "object" && "url" in value) {
      files.push(value as FileData);
    } else if (Array.isArray(value)) {
      files.push(...value.filter((item): item is FileData => item?.url));
    } else {
      populatedPrompt = populatedPrompt.replace(placeholder, String(value));
    }
  }

  const attachments: Attachment[] = files.map((file) => ({
    url: file.url,
    contentType: file.mimeType,
    name: file.fileName,
  }));

  try {
    const { object } = await generateObject({
      model: MODELS[modelName].model,
      schema: stepConfig.outputSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: populatedPrompt },
            ...(attachments.map((a) => ({
              type: "file",
              data: a.url,
              mimeType: a.contentType,
            })) as any),
          ],
        },
      ],
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);
    if (!validatedOutput.success) {
      throw new Error(
        `Output validation failed: ${validatedOutput.error.message}`
      );
    }

    return validatedOutput.data as StepOutputData;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[${step.id}] LLM step failed with ${modelName}:`, error);
    throw new Error(`LLM step ${step.id} failed: ${msg}`);
  }
};

export const executePdfPageExtractionStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as PdfPageExtractStepConfig["config"];
  const pageNumber = utils.getDataSourceValue(
    state,
    stepConfig.pageNumberSource
  ) as number;
  const pdfFileInfo = utils.getDataSourceValue(
    state,
    stepConfig.pdfDataSource
  ) as FileData;

  // Validate inputs
  if (!pdfFileInfo?.url || !pdfFileInfo.fileName) {
    throw new Error(
      `Invalid PDF at '${stepConfig.pdfDataSource}' in step ${step.id}`
    );
  }
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    throw new Error(
      `Invalid page number ${pageNumber} at '${stepConfig.pageNumberSource}' in step ${step.id}`
    );
  }

  // Load and validate PDF
  const pdfDoc = await PDFDocument.load(pdfFileInfo.url);
  if (pageNumber > pdfDoc.getPageCount()) {
    throw new Error(
      `Page ${pageNumber} exceeds PDF page count (${pdfDoc.getPageCount()})`
    );
  }

  // Extract page
  const newPdfDoc = await PDFDocument.create();
  const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
  newPdfDoc.addPage(copiedPage);

  // Convert to image
  const newPdfBytes = await newPdfDoc.save();
  const pageImage = await getPdfPageAsImage(newPdfBytes, 1, {
    format: "png",
    dpi: 150,
    maxDimension: 8000,
  });

  return { imageBase64: pageImage, pageNumber };
};

export const executeObjectDetectionStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as ObjectDetectionStepConfig["config"];
  const imageFileData = utils.getDataSourceValue(
    state,
    stepConfig.imageDataSource
  ) as string | undefined;

  // Validate input
  if (!imageFileData) {
    throw new Error(
      `Invalid image at '${stepConfig.imageDataSource}' in step ${step.id}`
    );
  }

  // Run object detection
  const { object } = await generateObject({
    model: MODELS[stepConfig.model].model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageFileData, mimeType: "image/png" },
          { type: "text", text: stepConfig.promptTemplate },
        ],
      },
    ],
    schema: z.object({
      bounding_boxes: z.array(
        z.object({ box_2d: z.array(z.number()).length(4), label: z.string() })
      ),
    }),
  });

  // Process image
  const image = await Jimp.read(Buffer.from(imageFileData, "base64"));
  const { width, height } = image.bitmap;
  const boundingBoxImages: FileData[] = [];

  for (const [
    index,
    {
      box_2d: [y_min, x_min, y_max, x_max],
      label,
    },
  ] of object.bounding_boxes.entries()) {
    // Validate coordinates
    if (x_min >= x_max || y_min >= y_max) {
      console.warn(
        `[${step.id}] Skipping invalid box for ${label}: [${y_min}, ${x_min}, ${y_max}, ${x_max}]`
      );
      continue;
    }

    // Convert normalized [0..1000] to pixel coordinates
    const x1 = Math.round((x_min / 1000) * width);
    const y1 = Math.round((y_min / 1000) * height);
    const x2 = Math.round((x_max / 1000) * width);
    const y2 = Math.round((y_max / 1000) * height);

    // Crop image
    const boxImage = image
      .clone()
      .crop({ h: y2 - y1, w: x2 - x1, x: x1, y: y1 });
    const boxImageBase64 = (await boxImage.getBuffer("image/jpeg")).toString(
      "base64"
    );

    boundingBoxImages.push({
      url: boxImageBase64,
      fileName: `box_${index}_${label}.jpeg`,
      mimeType: "image/jpeg",
    });
  }

  return {
    screenshots: boundingBoxImages,
  };
};

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
stepExecutorRegistry.set("object_detection", executeObjectDetectionStep);
