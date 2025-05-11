import { generateObject } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { Jimp } from "jimp";

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
