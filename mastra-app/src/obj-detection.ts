import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { Jimp } from "jimp";

import { getFileFromS3, uploadFileToS3 } from "./s3.ts";
import type { WorkflowFile, WorkflowRunStepOutput } from "./types.ts";

/**
 * Detects objects in an image and returns the cropped images.
 * @param imageBase64 - The base64 encoded image to detect objects in.
 * @param label - The type of object to detect.
 * @returns An array of cropped images.
 */
export async function objectDetection(imageBase64: string, label: string) {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.5-pro-preview-05-06"),
      schema: z.object({
        bounding_boxes: z.array(
          z.object({
            box_2d: z.array(z.number()).length(4),
            label: z.string(),
          })
        ),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageBase64,
              mimeType: "image/jpeg",
            },
            {
              type: "text",
              text: `Your task is to locate all instances of "${label}" and place 2d bounding boxes around them. Each bounding box should enclose the identified object. Make sure you capture the entire object and do not cut off any part of it, add some padding if needed.
Output the bounding boxes in the [y_min, x_min, y_max, x_max] format.
The top left corner is (0,0). The x axis goes left→right, the y axis top→bottom.
Coordinate values must be normalized to 0–1000 for both width and height.
Each entry should contain { "box_2d": [y_min, x_min, y_max, x_max], "label": "${label}" }.`,
            },
          ],
        },
      ],
    });

    // Load the inital image
    const image = await Jimp.read(Buffer.from(imageBase64, "base64"));
    const { width, height } = image.bitmap;

    const croppedImages: {
      fileName: string;
      base64: string;
      mimeType: string;
    }[] = [];

    for (const [index, boundingBox] of object.bounding_boxes.entries()) {
      const {
        box_2d: [y_min, x_min, y_max, x_max],
        label,
      } = boundingBox;

      // Convert normalized [0..1000] to pixel coordinates
      const padding = 20; // 20px padding on each side
      const x1 = Math.max(0, Math.round((x_min / 1000) * width) - padding);
      const y1 = Math.max(0, Math.round((y_min / 1000) * height) - padding);
      const x2 = Math.min(width, Math.round((x_max / 1000) * width) + padding);
      const y2 = Math.min(
        height,
        Math.round((y_max / 1000) * height) + padding
      );

      const croppedImage = image
        .clone()
        .crop({ h: y2 - y1, w: x2 - x1, x: x1, y: y1 });

      const croppedImageBase64 = (
        await croppedImage.getBuffer("image/jpeg")
      ).toString("base64");

      croppedImages.push({
        fileName: `${label}-${index}-${Date.now()}.jpeg`,
        base64: croppedImageBase64,
        mimeType: "image/jpeg",
      });
    }

    return croppedImages;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Detects objects in images from S3 and uploads the cropped images back to S3.
 * @param images - The images to detect objects in.
 * @param objectType - The type of object to detect.
 * @returns The cropped images as workflow outputs.
 */
export async function detectObjectsInS3Images(
  images: WorkflowRunStepOutput[],
  objectType: string,
  workflowId: string,
  workflowRunId: string
): Promise<WorkflowRunStepOutput[]> {
  // Load images from S3
  const loadedImages = await Promise.all(
    images.map(async (image) => {
      const { fileKey } = image.file as WorkflowFile;
      const file = await getFileFromS3(fileKey);
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

  // Run object detection on all images in parallel
  const detectionResults = await Promise.all(
    loadedImages.map((image) => objectDetection(image.base64, objectType))
  );

  // Flatten the results
  const flattenedResults = detectionResults.flat();

  // Upload the cropped images to S3
  const uploadPromises = flattenedResults.map((image) => {
    return uploadFileToS3(
      `workflows/${workflowId}/${workflowRunId}/${image.fileName}`,
      Buffer.from(image.base64, "base64"),
      image.mimeType
    );
  });

  await Promise.all(uploadPromises);

  // Return the workflow outputs
  return flattenedResults.map((image) => ({
    type: "file" as const,
    file: {
      fileKey: `workflows/${workflowId}/${workflowRunId}/${image.fileName}`,
      mimeType: image.mimeType,
      fileName: image.fileName,
    },
  }));
}
