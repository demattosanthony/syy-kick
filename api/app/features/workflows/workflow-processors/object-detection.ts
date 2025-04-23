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
