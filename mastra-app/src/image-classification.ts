import { GetObjectCommand } from "@aws-sdk/client-s3";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import s3 from "./s3.ts";
import type { WorkflowRunStepOutput } from "./types.ts";
import { z } from "zod";

interface ImageClassificationOptions {
  prompt: string;
  schema: z.ZodType<any>;
}

/**
 * Classifies images based on the given prompt and schema.
 * @param images - The images to classify.
 * @param options - The options for the classification.
 * @returns The images that match the classification.
 */
export async function classifyImages(
  images: WorkflowRunStepOutput[],
  options: ImageClassificationOptions
): Promise<WorkflowRunStepOutput[]> {
  // Load images from S3
  const loadedImages = await Promise.all(
    images.map(async (image) => {
      const file = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: image.file?.fileKey,
        })
      );
      const imageData = await file.Body?.transformToByteArray();

      if (!imageData) {
        throw new Error("No data found");
      }

      return {
        fileKey: image.file?.fileKey,
        base64: Buffer.from(imageData).toString("base64"),
      };
    })
  );

  // Run classification on all images in parallel
  const results = await Promise.all(
    loadedImages.map((image) =>
      generateObject({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.prompt,
              },
              {
                type: "image",
                image: image.base64,
                mimeType: "image/png",
              },
            ],
          },
        ],
        model: openai("gpt-4.1"),
        schema: options.schema,
      })
    )
  );

  // Filter and map results
  const outputs = loadedImages
    .filter((_, index) => {
      const result = results[index].object as Record<string, boolean>;
      // Check if the result has a boolean property that indicates a match
      // This assumes the schema has a boolean property like hasBomTable or hasWindowOrDoorSchedule
      return Object.values(result)[0] === true;
    })
    .map((image) => ({
      type: "file" as const,
      file: {
        fileKey: image.fileKey!,
        mimeType: "image/png",
        fileName: image.fileKey!,
      },
    }));

  return outputs;
}
