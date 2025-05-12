import { createWorkflow, createStep } from "@mastra/core/workflows/vNext";
import { z } from "zod";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

import { convertPdfToImages } from "../../pdf-to-images.ts";
import { objectDetection } from "../../obj-detection.ts";
import s3 from "../../s3.ts";
import logger from "../../logger.ts";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";
import { mistralOcr } from "../../ocr.ts";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  controlsDrawings: z.object({
    type: z.literal("file"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
    }),
  }),
});

const stepOne = createStep({
  id: "stepOne",
  inputSchema: inputSchema,
  outputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const controlsDrawings = inputData.controlsDrawings;
    const { fileKey } = controlsDrawings.value as WorkflowFile;

    const file = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
      })
    );
    const pdfData = await file.Body?.transformToByteArray();

    if (!pdfData) {
      throw new Error("No data found");
    }

    const images = await convertPdfToImages(Buffer.from(pdfData));
    logger.info(`Extracted ${images.length} images from PDF`);

    // debug - save the images to disk
    // for (let i = 0; i < images.length; i++) {
    //   const image = images[i];
    //   await fs.writeFile(
    //     `./logs/page_${image.page}.png`,
    //     Buffer.from(image.base64, "base64")
    //   );
    // }

    // Upload the images to S3
    const uploadPromises = images.map((image) => {
      const fileKey = `uploads/${image.name}`;
      return s3
        .send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: fileKey,
            Body: Buffer.from(image.base64, "base64"),
            ContentType: "image/png",
          })
        )
        .then(() => ({
          type: "file" as const,
          file: {
            fileKey,
            mimeType: "image/png",
            fileName: image.name,
          },
        }));
    });

    const uploadedImages = await Promise.all(uploadPromises);

    logger.info(`Returning ${uploadedImages.length} images`);

    return {
      convertedImages: uploadedImages,
    };
  },
});

const stepTwo = createStep({
  id: "stepTwo",
  inputSchema: z.object({
    convertedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    imagesWithBomTables: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { convertedImages } = inputData;

    const images = await Promise.all(
      convertedImages.map(async (image) => {
        const file = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: image.file?.fileKey,
          })
        );
        const pdfData = await file.Body?.transformToByteArray();

        if (!pdfData) {
          throw new Error("No data found");
        }

        return {
          fileKey: image.file?.fileKey,
          base64: Buffer.from(pdfData).toString("base64"),
        };
      })
    );

    // Check all images for BOM tables in parallel
    const results = await Promise.all(
      images.map((image) =>
        generateObject({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Your task is to analyze an image from a control drawings pdf documentand determine if there are any bill of materials embedded tables on it. 
These tables typically list details about components used in the control system, such as sizes, types, and quantities. The table header should also be Bill of Materials.`,
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
          schema: z.object({
            hasBomTable: z.boolean(),
          }),
        })
      )
    );

    const outputs = images
      .filter((_, index) => results[index].object.hasBomTable)
      .map((image) => ({
        type: "file" as const,
        file: {
          fileKey: image.fileKey!,
          mimeType: "image/png",
          fileName: image.fileKey!,
        },
      }));

    console.log("Number of images with BOM tables: ", outputs.length);

    return {
      imagesWithBomTables: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  inputSchema: z.object({
    imagesWithBomTables: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { imagesWithBomTables } = inputData;

    // Load images that have BOM tables on them
    const images = await Promise.all(
      imagesWithBomTables.map(async (image) => {
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

    // Do object detection to get images of just the BOM tables
    const croppedImages = await Promise.all(
      images.map(async (image) => {
        return await objectDetection(image.base64, "Bill of Materials Table");
      })
    );

    // Flatten the cropped images
    const flattenedCroppedImages = croppedImages.flat();
    logger.info(`Flattened ${flattenedCroppedImages.length} cropped images`);

    // debug - save the cropped images to disk
    // for (let i = 0; i < flattenedCroppedImages.length; i++) {
    //   const image = flattenedCroppedImages[i];
    //   await fs.writeFile(
    //     `./logs/cropped_${i}_${image.fileName}`,
    //     Buffer.from(image.base64, "base64")
    //   );
    // }

    // Upload the cropped images to S3
    const uploadPromises = flattenedCroppedImages.map((image) => {
      return s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: `uploads/${image.fileName}`,
          Body: Buffer.from(image.base64, "base64"),
          ContentType: image.mimeType,
        })
      );
    });

    await Promise.all(uploadPromises);

    const outputs = flattenedCroppedImages.map((image) => ({
      type: "file" as const,
      file: {
        fileKey: `uploads/${image.fileName}`,
        mimeType: image.mimeType,
        fileName: image.fileName,
      },
    }));

    // Log presigned urls for the cropped images
    for (const output of outputs) {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: output.file?.fileKey,
      });
      const presignedUrlString = await getSignedUrl(s3, command, {
        expiresIn: 3600,
      }); // Expires in 1 hour
      logger.info(
        `Presigned url for ${output.file?.fileKey}: ${presignedUrlString}`
      );
    }

    return {
      croppedImages: outputs,
    };
  },
});

const stepFour = createStep({
  id: "stepFour",
  inputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    ocrResults: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    logger.info("Running step four");
    const { croppedImages } = inputData;

    // For each cropped image, run OCR to get the text
    const ocrResults = await Promise.all(
      croppedImages.map(async (image) => {
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

        const result = await mistralOcr({
          base64: Buffer.from(imageData).toString("base64"),
          mimeType: "image/jpeg",
          includeImages: false,
        });

        // const ocrResult = result.pages
        //   .map((page) => page.markdown)
        //   .join("\n\n");

        const { object } = await generateObject({
          model: openai("gpt-4.1"),
          schema: z.object({
            ocrResult: z.string(),
          }),
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Your task is to operate an an OCR model to extract the text from an image. You will be given an image of a bill of materials table. You will need to extract the text from the image and return it as a string in markdown format. That represents the text from the image. Do not return anything else other than the markdown text. Do not make up any informaiton that is not in the image.`,
                },
                {
                  type: "image",
                  image: imageData,
                  mimeType: "image/jpeg",
                },
              ],
            },
          ],
        });

        return object.ocrResult;
      })
    );

    logger.info(`OCR results: ${ocrResults.length}`);

    const outputs = ocrResults.map((ocrResult) => ({
      type: "text" as const,
      text: ocrResult,
    }));

    logger.info(`Returning ${outputs.length} ocr results`);

    return {
      ocrResults: outputs,
    };
  },
});

const stepFive = createStep({
  id: "stepFive",
  inputSchema: z.object({
    ocrResults: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    totalizedBomCsvFile: WorkflowRunStepOutputSchema,
  }),
  execute: async ({ inputData }) => {
    logger.info("Running step five");
    const { ocrResults } = inputData;
    logger.info(`OCR results: ${ocrResults.length}`);

    // Use llm to create a totalized BOM from the ocr results
    const totalizedBom = await generateObject({
      model: google("gemini-2.5-pro-exp-03-25"),
      schema: z.object({
        totalizedBomCsvContent: z.string(),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your goal is to create a totalzed BOM CSV file that consolidates all bill of materials tables from a controls pdf into a single table.

Steps:
1. Read all the text files that are available.
2. Extract all part numbers and their quantities from each BOM table.
3. Group the part numbers by their make (manufacturer).
4. Aggregate the quantities for any duplicate parts across all tables.
5. Create a final table with two columns: Part Number and Total Quantity.

CSV Formatting:

| Part Number | Total Quantity |
|-------------|----------------|
| [MAKE 1] |                |
| [Part No. 1] | [Quantity]     |
| [Part No. 2] | [Quantity]     |
| [MAKE 2] |                |
| [Part No. 3] | [Quantity]     |
| ...         | ...            |

Ensure that your final consolidated BOM:
- Includes all unique part numbers from all BOM tables
- Groups part numbers by their make
- Shows the total quantity for each part number
- Is presented in a clear, easily readable format

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"
6. Use all caps for the make names

Remember to use your expertise to provide the most accurate and comprehensive consolidated BOM possible based on the given information.

Return only the csv string and nothing else.`,
            },
            {
              type: "text",
              text: `Here are the OCR results:\n\n ${ocrResults.map((ocrResult) => ocrResult.text).join("\n\n")}`,
            },
          ],
        },
      ],
    });
    logger.info(`Totalized BOM: ${totalizedBom.object.totalizedBomCsvContent}`);

    const totalizedBomCsvContent = totalizedBom.object.totalizedBomCsvContent;

    const fileKey = `uploads/totalized-bom.csv`;

    // Upload the totalized BOM CSV to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
        Body: Buffer.from(totalizedBomCsvContent, "utf-8"),
        ContentType: "text/csv",
      })
    );

    // Get the presigned url for the totalized BOM CSV
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: fileKey,
    });
    const presignedUrlString = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    const csvFile = {
      type: "file" as const,
      file: {
        fileKey,
        mimeType: "text/csv",
        fileName: "totalized-bom.csv",
        fileUrl: presignedUrlString,
      },
    };

    return {
      totalizedBomCsvFile: csvFile,
    };
  },
});

// Build the workflow
const totalizedBomBuilder = createWorkflow({
  id: "totalized-bom-builder",
  inputSchema: inputSchema,
  outputSchema: z.object({}),
  steps: [stepOne, stepTwo, stepThree, stepFour, stepFive],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

export { totalizedBomBuilder };
