import {
  ObjectDetectionStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "../workflows.schemas";
import { MODELS } from "../../models";
import { generateObject } from "ai";
import { z } from "zod";
import { Jimp } from "jimp";
import { FileData } from "../workflows.schemas";

/**
 * Process a single image and return the bounding boxes.
 * @param imageData - The image data to process.
 * @param stepId - The ID of the step.
 * @param config - The configuration for the step.
 * @param debug - Whether to enable debug mode.
 */
async function processImage(
  imageData: string,
  stepId: string,
  config: ObjectDetectionStepConfig["config"],
  sourceImageIndex: number,
  debug: boolean
): Promise<FileData[]> {
  const model = MODELS[config.model].model;
  const prompt = config.promptTemplate;

  if (debug) {
    console.log(`[${stepId}] Prompt:`, prompt);
    console.log(`[${stepId}] Processing one image...`);
  }

  // Run object detection
  const { object } = await generateObject({
    model: model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageData, mimeType: "image/png" },
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
    console.log(`[${stepId}] Detected Bounding Boxes:`, object.bounding_boxes);
  }

  // Process image
  const image = await Jimp.read(Buffer.from(imageData, "base64"));
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
        `[${stepId}] Skipping invalid box for ${label}: [${y_min}, ${x_min}, ${y_max}, ${x_max}]`
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
        const imageFilePath = `./debug-images/${stepId}_img_${sourceImageIndex}_box_${index}_${safeLabel}.jpeg`;
        await Bun.write(imageFilePath, Buffer.from(boxImageBase64, "base64"));
        console.log(`[${stepId}] Saved box ${index} to ${imageFilePath}`);
      } catch (writeError) {
        console.error(`[${stepId}] Failed to save box ${index}:`, writeError);
      }
    }
  }
  return boundingBoxImages;
}

/**
 * Execute the object detection step.
 * @param input - The input for the step.
 * @param debug - Whether to enable debug mode.
 */
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
  ) as string | undefined | string[];

  // Validate input
  if (!imageFileData) {
    throw new Error(
      `Invalid image at '${stepConfig.imageDataSource}' in step ${step.id}`
    );
  }

  const imagesToProcess = Array.isArray(imageFileData)
    ? imageFileData
    : [imageFileData];

  let allBoundingBoxImages: FileData[] = [];

  for (const [sourceIndex, singleImage] of imagesToProcess.entries()) {
    if (typeof singleImage !== "string") {
      console.warn(
        `[${step.id}] Skipping non-string image data:`,
        typeof singleImage
      );
      continue; // Skip if it's not a string (e.g., could be undefined in the array)
    }
    try {
      const boundingBoxes = await processImage(
        singleImage,
        step.id,
        stepConfig,
        sourceIndex,
        debug
      );
      allBoundingBoxImages = allBoundingBoxImages.concat(boundingBoxes);
    } catch (error) {
      console.error(`[${step.id}] Error processing one image:`, error);
      // Decide if you want to throw, continue, or handle partially
      // For now, log the error and continue with other images
    }
  }

  if (debug) {
    console.log(
      `[${step.id}] Total bounding box images generated:`,
      allBoundingBoxImages.length
    );
  }

  return {
    screenshots: allBoundingBoxImages,
  };
};
