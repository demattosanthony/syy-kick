import { generateObject, tool, Tool } from "ai";
import { z } from "zod";
import { ArtifactService } from "../artifact-service";
import { google } from "@ai-sdk/google";
import { Jimp } from "jimp";

export function createObjectDetectionTool(
  toolArtifactService: ArtifactService
): Tool {
  return tool({
    description:
      "Analyzes an image artifact (specified by `fileName`) to detect objects using an AI model. For each object found, it crops the image around the object's bounding box and saves this cropped region as a new, separate image artifact in the artifact service.",
    parameters: z.object({
      fileName: z
        .string()
        .describe("The name of the image file to detect objects in."),
      label: z.string().describe("The label of the object to detect."),
    }),
    execute: async ({ fileName, label }) => {
      const imageArtifact = await toolArtifactService.loadArtifact(fileName);
      if (!imageArtifact) {
        return {
          success: false,
          message: `Image '${fileName}' not found.`,
        };
      }

      const imagebase64 = Buffer.from(imageArtifact.data).toString("base64");

      const { object } = await generateObject({
        model: google("gemini-2.5-pro-preview-06-05"),
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
                image: imagebase64,
                mimeType: imageArtifact.mimeType,
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

      // Process image
      const image = await Jimp.read(Buffer.from(imagebase64, "base64"));
      const { width, height } = image.bitmap;

      for (const [index, boundingBox] of object.bounding_boxes.entries()) {
        const {
          box_2d: [y_min, x_min, y_max, x_max],
          label,
        } = boundingBox;

        // Convert normalized [0..1000] to pixel coordinates
        const padding = 20; // 20px padding on each side
        const x1 = Math.max(0, Math.round((x_min / 1000) * width) - padding);
        const y1 = Math.max(0, Math.round((y_min / 1000) * height) - padding);
        const x2 = Math.min(
          width,
          Math.round((x_max / 1000) * width) + padding
        );
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

        toolArtifactService.saveArtifact(`${fileName}-${label}-${index}.jpeg`, {
          data: Buffer.from(croppedImageBase64, "base64"),
          mimeType: "image/jpeg",
        });
      }

      return {
        success: true,
        message: `Successfully detected ${object.bounding_boxes.length} objects in '${fileName}' and saved them as artifacts.`,
      };
    },
  });
}
