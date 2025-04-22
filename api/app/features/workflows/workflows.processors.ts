import { Attachment, generateObject } from "ai";
import {
  FileData,
  LLMStepConfig,
  ObjectDetectionStepConfig,
  PdfPageExtractStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
  DocumentOCRStepConfig,
} from "./workflows.schemas";
import { mistralAi, MODELS } from "../models";
import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "../../utils";
import { z } from "zod";
import { Jimp } from "jimp";
import { mistralOcr } from "../../doc-processor";

export const executeLLMStep: StepExecutorFunction = async ({
  step,
  inputs,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  if (debug) {
    console.log(`[${step.id}]`);
  }
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

  if (debug) {
    console.log(`[${step.id}] Populated Prompt:`, populatedPrompt);
    console.log(
      `[${step.id}] Attachments:`,
      attachments.map((a) => a.name)
    );
  }

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
              type: a.contentType?.startsWith("image") ? "image" : "file",
              [a.contentType?.startsWith("image") ? "image" : "data"]: a.url,
              mimeType: a.contentType,
            })) as any),
          ],
        },
      ],
      experimental_repairText: async ({ text, error }) => {
        if (debug) {
          console.log("[experimental_repairText] Original text:", text);
          console.log("[experimental_repairText] Error:", error);
        }

        // Remove 'ny\n' and ```json wrappers from the text
        const cleaned = text
          .replace("ny\n", "")
          .replace(/```json\n/g, "")
          .replace(/```/g, "")
          .trim();

        if (debug) {
          console.log("[experimental_repairText] Cleaned text:", cleaned);
        }

        return cleaned;
      },
    });

    const validatedOutput = stepConfig.outputSchema.safeParse(object);
    if (!validatedOutput.success) {
      throw new Error(
        `Output validation failed: ${validatedOutput.error.message}`
      );
    }

    if (debug) {
      console.log(`[${step.id}] Validated Output:`, validatedOutput.data);
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
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as PdfPageExtractStepConfig["config"];
  if (debug) {
    console.log(`[${step.id}] Inputs:`, {
      pdfDataSource: stepConfig.pdfDataSource,
      pageNumberSource: stepConfig.pageNumberSource,
    });
  }
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

  // In prod, the PDF is a presigned URL, so we need to fetch it
  // Otherwise, it's already a base64 string
  let pdfBase64: string;
  try {
    const url = pdfFileInfo.url;
    if (CONFIG.__prod__) {
      // Fetch the PDF content from the URL (it's a pre-signed URL in prod)
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
    } else {
      pdfBase64 = url;
    }
  } catch (error) {
    throw new Error(
      `Failed to get PDF data from '${stepConfig.pdfDataSource}' in step ${step.id}: ${error}`
    );
  }

  // Load and validate PDF
  const pdfDoc = await PDFDocument.load(pdfBase64);
  if (pageNumber > pdfDoc.getPageCount()) {
    throw new Error(
      `Page ${pageNumber} exceeds PDF page count (${pdfDoc.getPageCount()})`
    );
  }

  if (debug) {
    console.log(
      `[${
        step.id
      }] Extracting page ${pageNumber} from PDF with ${pdfDoc.getPageCount()} pages`
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

  if (debug) {
    try {
      const imageFilePath = `./debug-images/${step.id}_page_${pageNumber}.png`;
      await Bun.write(imageFilePath, Buffer.from(pageImage, "base64"));
      console.log(`[${step.id}] Saved image to ${imageFilePath}`);
    } catch (writeError) {
      console.error(`[${step.id}] Failed to save image:`, writeError);
    }
  }

  return { imageBase64: pageImage, pageNumber };
};

export const executeObjectDetectionStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as ObjectDetectionStepConfig["config"];
  if (debug) {
    console.log(`[${step.id}] Inputs:`, {
      imageDataSource: stepConfig.imageDataSource,
    });
  }
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

  const model = MODELS[stepConfig.model].model;
  const prompt = stepConfig.promptTemplate;

  if (debug) {
    console.log(`[${step.id}] Prompt:`, prompt);
  }

  // Run object detection
  const { object } = await generateObject({
    model: model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageFileData, mimeType: "image/png" },
          { type: "text", text: prompt },
        ],
      },
    ],
    schema: z.object({
      bounding_boxes: z.array(
        z.object({ box_2d: z.array(z.number()).length(4), label: z.string() })
      ),
    }),
    experimental_repairText: async ({ text }) => {
      if (debug) {
        console.log("[experimental_repairText] Original text:", text);
      }

      // Remove 'ny\n' and ```json wrappers from the text
      const cleaned = text
        .replace("ny\n", "")
        .replace(/```json\n/g, "")
        .replace(/```/g, "")
        .trim();

      if (debug) {
        console.log("[experimental_repairText] Cleaned text:", cleaned);
      }

      // Check if the cleaned text is an array string
      if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
        // Wrap the array string in the expected object structure
        const wrapped = `{ "bounding_boxes": ${cleaned} }`;
        if (debug) {
          console.log("[experimental_repairText] Wrapped text:", wrapped);
        }
        return wrapped;
      }

      // Otherwise, return the cleaned text as is
      return cleaned;
    },
  });

  if (debug) {
    console.log(`[${step.id}] Detected Bounding Boxes:`, object.bounding_boxes);
  }

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
    const padding = 20; // 20px padding on each side
    const x1 = Math.max(0, Math.round((x_min / 1000) * width) - padding);
    const y1 = Math.max(0, Math.round((y_min / 1000) * height) - padding);
    const x2 = Math.min(width, Math.round((x_max / 1000) * width) + padding);
    const y2 = Math.min(height, Math.round((y_max / 1000) * height) + padding);

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

    if (debug) {
      try {
        const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();
        const imageFilePath = `./debug-images/${step.id}_box_${index}_${safeLabel}.jpeg`;
        await Bun.write(imageFilePath, Buffer.from(boxImageBase64, "base64"));
        console.log(`[${step.id}] Saved box ${index} to ${imageFilePath}`);
      } catch (writeError) {
        console.error(`[${step.id}] Failed to save box ${index}:`, writeError);
      }
    }
  }

  return {
    screenshots: boundingBoxImages,
  };
};

export const documentOcrStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as DocumentOCRStepConfig["config"];
  const chunkSize = 25; // Define chunk size

  if (debug) {
    console.log(`[${step.id}] Inputs:`, {
      documentDataSource: stepConfig.documentDataSource,
      chunkSize,
    });
  }

  const documentFileData = utils.getDataSourceValue(
    state,
    stepConfig.documentDataSource
  ) as FileData | undefined;

  // Validate input
  if (!documentFileData?.url || !documentFileData.fileName) {
    throw new Error(
      `Invalid document at '${stepConfig.documentDataSource}' in step ${step.id}`
    );
  }

  // Run OCR
  const result = await mistralOcr({
    base64: documentFileData.url,
    mimeType: "application/pdf",
    includeImages: true,
  });

      // Process results for the chunk
      for (const [pageIndexInChunk, item] of result.pages.entries()) {
        const absolutePageIndex = startPage + pageIndexInChunk; // Calculate absolute page index

        if (item.markdown) {
          combinedMarkdown += item.markdown + "\n\n";
        }

        for (
          let imageIndex = 0;
          imageIndex < item.images.length;
          imageIndex++
        ) {
          const image = item.images[imageIndex];
          if (!image.imageBase64) {
            continue;
          }

          // Extract base64 data, removing any prefix if present
          let imageBase64 = image.imageBase64;
          if (imageBase64.includes(",")) {
            imageBase64 = imageBase64.split(",", 2)[1];
          }

          // Use absolute page index in file name
          const fileName = `page_${absolutePageIndex}_image_${image.id}`;
          combinedImages.push({
            url: imageBase64,
            fileName: fileName,
            mimeType: "image/jpeg", // Assuming JPEG, adjust if needed
          });

          if (debug) {
            try {
              const imageFilePath = `./debug-images/${step.id}_${fileName}.jpeg`;
              await Bun.write(
                imageFilePath,
                Buffer.from(imageBase64, "base64")
              );
              console.log(
                `[${step.id}] Saved image from page ${
                  absolutePageIndex + 1
                }: ${imageFilePath}`
              );
            } catch (error) {
              console.error(
                `[${step.id}] Failed to save debug image ${fileName}:`,
                error
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `[${step.id}] OCR failed for chunk pages ${startPage + 1}-${endPage}:`,
        error
      );
      // Decide if we should continue with other chunks or throw
      // For now, let's log and continue, potentially returning partial results
      // Alternatively: throw new Error(`OCR failed for chunk pages ${startPage + 1}-${endPage}: ${error}`);
    }
  } // End chunk loop

  if (debug) {
    console.log(
      `[${step.id}] Finished processing all chunks. Total images extracted: ${combinedImages.length}`
    );
  }

  return {
    markdown: combinedMarkdown.trim(), // Trim trailing newlines
    images: combinedImages,
  };
};

export const stepExecutorRegistry = new Map<string, StepExecutorFunction>();
stepExecutorRegistry.set("llm", executeLLMStep);
stepExecutorRegistry.set("pdf_page_extract", executePdfPageExtractionStep);
stepExecutorRegistry.set("object_detection", executeObjectDetectionStep);
stepExecutorRegistry.set("document_ocr", documentOcrStep);
