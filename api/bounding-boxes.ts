import { generateObject } from "ai";
import { MODELS } from "./app/features/models";
import { z } from "zod";
import { Jimp } from "jimp";

const imagePath = "./ocr-results/good-tester.jpeg";

// Read file and create base64 url
const file = await Bun.file(imagePath).bytes();
const base64 = Buffer.from(file).toString("base64");

// Example prompting – you may need to tweak the prompt to improve detection accuracy
const { object } = await generateObject({
  model: MODELS["claude-3.7-sonnet"].model,
  temperature: 0,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          image: base64,
          mimeType: "image/jpeg",
        },
        {
          type: "text",
          text: `Detect all engineering equipment schedule tables, with no more than 20 items. Each schedule table bounding box should contain the table title and all the rows of the table.
Output the bounding boxes in the [y_min, x_min, y_max, x_max] format.
The top left corner is (0,0). The x axis goes left→right, the y axis top→bottom.
Coordinate values must be normalized to 0–1000 for both width and height.
Each entry should contain { "box_2d": [y_min, x_min, y_max, x_max], "label": "..." }.`,
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

// Convenience function to clamp values between 0 and a maximum
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// A helper function to draw a rectangular outline
function drawRectOutline(
  image: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number = 0x0000ffff,
  thickness: number = 3
): void {
  // Ensure x1 < x2 and y1 < y2 (swap if needed)
  if (x1 > x2) [x1, x2] = [x2, x1];
  if (y1 > y2) [y1, y2] = [y2, y1];

  // Make sure we don't go out of bounds
  x1 = clamp(x1, 0, image.bitmap.width - 1);
  x2 = clamp(x2, 0, image.bitmap.width - 1);
  y1 = clamp(y1, 0, image.bitmap.height - 1);
  y2 = clamp(y2, 0, image.bitmap.height - 1);

  // Use image.scan to draw top and bottom edges
  // top edge
  image.scan(
    x1,
    y1,
    x2 - x1 + 1,
    thickness,
    (dx: number, dy: number, idx: number) => {
      image.setPixelColor(color, dx, dy);
    }
  );
  // bottom edge
  image.scan(
    x1,
    y2 - thickness + 1,
    x2 - x1 + 1,
    thickness,
    (dx: number, dy: number, idx: number) => {
      image.setPixelColor(color, dx, dy);
    }
  );

  // left edge
  image.scan(
    x1,
    y1,
    thickness,
    y2 - y1 + 1,
    (dx: number, dy: number, idx: number) => {
      image.setPixelColor(color, dx, dy);
    }
  );
  // right edge
  image.scan(
    x2 - thickness + 1,
    y1,
    thickness,
    y2 - y1 + 1,
    (dx: number, dy: number, idx: number) => {
      image.setPixelColor(color, dx, dy);
    }
  );
}

async function drawBoundingBoxes() {
  try {
    // Load the image
    const image = await Jimp.read(imagePath);
    const { width, height } = image.bitmap;

    // Draw each bounding box
    object.bounding_boxes.forEach(({ box_2d, label }, index) => {
      // Destructure [y_min, x_min, y_max, x_max]
      const [y_min, x_min, y_max, x_max] = box_2d;

      // Convert normalized [0..1000] → actual pixel coordinates
      const x1 = Math.round((x_min / 1000) * width);
      const y1 = Math.round((y_min / 1000) * height);
      const x2 = Math.round((x_max / 1000) * width);
      const y2 = Math.round((y_max / 1000) * height);

      // Draw a rectangular outline
      drawRectOutline(image, x1, y1, x2, y2, 0x0000ffff, 3); // color = blue

      // Extract the bounding box as a new image
      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;

      console.log(`Bounding box ${index}: ${label}`);
      console.log(`Coordinates: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`);
      console.log(`Width: ${boxWidth}, Height: ${boxHeight}`);

      // Clone the original image and crop to the bounding box
      const boxImage = image.clone().crop({
        h: boxHeight,
        w: boxWidth,
        x: x1,
        y: y1,
      });

      // Create a sanitized label for filename (replace spaces and special chars)
      const safeLabel = label.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      // Save the cropped image
      boxImage
        .write(`./ocr-results/box_${index}_${safeLabel}.jpeg`)
        .then(() => console.log(`Saved bounding box ${index}: ${label}`))
        .catch((err) => console.error(`Error saving box ${index}:`, err));

      console.log(
        "Cropped image saved to ./ocr-results/box_${index}_${safeLabel}.jpeg"
      );

      // Optionally, if you want labels:
      //   const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      //   image.print(font, x1, Math.max(y1 - 20, 0), label);
    });

    // Save the modified image
    const outputPath = "./ocr-results/output-with-boxes.jpeg";
    await Bun.write(outputPath, await image.getBuffer("image/jpeg"));
    console.log(`Image with bounding boxes saved to ${outputPath}`);
  } catch (error) {
    console.error("Error drawing bounding boxes:", error);
  }
}

// Run it
await drawBoundingBoxes();
