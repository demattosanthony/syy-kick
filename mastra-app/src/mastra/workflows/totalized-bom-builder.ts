import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import fs from "node:fs/promises";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { fromBuffer } from "pdf2pic";

import { bomTableDetectorAgent } from "../agents/bom-table-detector.ts";
import s3 from "../../s3.ts";
import type { Options } from "pdf2pic/dist/types/options";

const stepOne = new Step({
  id: "stepOne",
  execute: async ({ context }) => {
    const { fileKey } = context.triggerData;
    const file = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
      })
    );
    const data = await file.Body?.transformToByteArray();

    if (!data) {
      throw new Error("No data found");
    }

    const options: Options = {
      density: 300,
      saveFilename: "untitled",
      savePath: "./",
      format: "png",
      quality: 600,
      preserveAspectRatio: true,
      width: 2400,
      height: 2400,
    };

    const convert = fromBuffer(Buffer.from(data), options);

    // Convert all pages of the PDF using the bulk method
    // Setting pages to -1 converts all pages
    const images = await convert.bulk(-1, { responseType: "image" });

    return { images };
  },
});

type StepOneOutput = {
  images: Array<{
    name: string;
    path: string;
    size: number;
    page: number;
    base64: string;
  }>;
};

const stepTwo = new Step({
  id: "stepTwo",
  execute: async ({ context }) => {
    const { images } = context.getStepResult<StepOneOutput>("stepOne");

    let imagesWithBomTables = [];

    // Check if the image has any BOM tables on it
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const pageNum = image.page;

      const { object } = await bomTableDetectorAgent.generate(
        [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: image.base64, // The base64 representation is already available
                mimeType: "image/png",
              },
              {
                type: "text",
                text: `This is page ${pageNum} of the PDF.`,
              },
            ],
          },
        ],
        {
          output: z.object({
            hasBomTable: z.boolean(),
          }),
        }
      );

      if (object.hasBomTable) {
        imagesWithBomTables.push(image);

        // debug - save the image to disk
        await fs.writeFile(
          `./page_${pageNum}_with_bom_table.png`,
          Buffer.from(image.base64, "base64")
        );
      }
    }

    return {
      imagesWithBomTables,
    };
  },
});

// Build the workflow
const totalizedBomBuilder = new Workflow({
  name: "totalized-bom-builder",
  triggerSchema: z.object({
    fileKey: z.string(),
  }),
});

// sequential steps
totalizedBomBuilder.step(stepOne);

totalizedBomBuilder.commit();

export { totalizedBomBuilder };
