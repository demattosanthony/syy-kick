// Core dependencies
import { z } from "zod";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

// AWS dependencies
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../../s3.ts";

// AI/ML dependencies
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { objectDetection } from "../../obj-detection.ts";

// Workflow dependencies
import { createWorkflow, createStep } from "@mastra/core/workflows/vNext";
import {
  WorkflowRunStepOutputSchema,
  type WorkflowExecutionInputValues,
  type WorkflowFile,
} from "../../types.ts";

// Utilities
import { convertPdfToImages } from "../../pdf-to-images.ts";
import logger from "../../logger.ts";
import { google } from "@ai-sdk/google";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  architecturalPdf: z.object({
    type: z.literal("file"),
    label: z.literal("Architectural PDF"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.literal("application/pdf"),
      fileName: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  windowAndDoorScheduleCsvFile: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      fileUrl: z.string().optional(),
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
    const architecturalPdf = inputData.architecturalPdf;
    const { fileKey } = architecturalPdf.value as WorkflowFile;

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
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
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
                  text: `Your task is to analyze an image from a architectural drawings pdf documentand determine if there are any window or door schedules embedded tables on it. 
These schedules typically list details about windows and doors used in the building, such as sizes, types, and quantities. The table header will be something like "Window Schedule" or "Door Schedule".`,
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
            hasWindowOrDoorSchedule: z.boolean(),
          }),
        })
      )
    );

    const outputs = images
      .filter((_, index) => results[index].object.hasWindowOrDoorSchedule)
      .map((image) => ({
        type: "file" as const,
        file: {
          fileKey: image.fileKey!,
          mimeType: "image/png",
          fileName: image.fileKey!,
        },
      }));

    // Save the images with BOM tables to disk
    for (const output of outputs) {
      const file = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: output.file?.fileKey,
        })
      );
      const imageData = await file.Body?.transformToByteArray();

      if (!imageData) {
        throw new Error("No data found");
      }

      await fs.writeFile(`./logs/${randomUUID()}.png`, Buffer.from(imageData));
    }

    console.log(
      "Number of images with window or door schedules: ",
      outputs.length
    );

    return {
      imagesWithWindowOrDoorSchedules: outputs,
    };
  },
});

const stepThree = createStep({
  id: "stepThree",
  inputSchema: z.object({
    imagesWithWindowOrDoorSchedules: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: z.object({
    croppedImages: z.array(WorkflowRunStepOutputSchema),
  }),
  execute: async ({ inputData }) => {
    const { imagesWithWindowOrDoorSchedules } = inputData;

    // Load images that have BOM tables on them
    const images = await Promise.all(
      imagesWithWindowOrDoorSchedules.map(async (image) => {
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
        return await objectDetection(
          image.base64,
          "Window or Door Schedule Table"
        );
      })
    );

    // Flatten the cropped images
    const flattenedCroppedImages = croppedImages.flat();
    logger.info(`Flattened ${flattenedCroppedImages.length} cropped images`);

    // debug - save the cropped images to disk
    for (let i = 0; i < flattenedCroppedImages.length; i++) {
      const image = flattenedCroppedImages[i];
      await fs.writeFile(
        `./logs/cropped_${i}_${image.fileName}`,
        Buffer.from(image.base64, "base64")
      );
    }

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
    // for (const output of outputs) {
    //   const command = new GetObjectCommand({
    //     Bucket: process.env.S3_BUCKET_NAME!,
    //     Key: output.file?.fileKey,
    //   });
    //   const presignedUrlString = await getSignedUrl(s3, command, {
    //     expiresIn: 3600,
    //   }); // Expires in 1 hour
    //   logger.info(
    //     `Presigned url for ${output.file?.fileKey}: ${presignedUrlString}`
    //   );
    // }

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
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
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
                  text: `Your task is to operate an an OCR model to extract the text from an image. You will be given an image of a window or door schedule table. You will need to extract the text from the image and return it as a string in markdown format. That represents the text from the image. Do not return anything else other than the markdown text (make sure to add the proper lines for the table formatting). Do not make up any informaiton that is not in the image.`,
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

    // Upload OCR results to S3 and create file references
    const files = await Promise.all(
      ocrResults.map(async (ocrResult, index) => {
        const fileKey = `uploads/ocr_${index}.md`;

        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: fileKey,
            Body: Buffer.from(ocrResult, "utf-8"),
            ContentType: "text/markdown",
          })
        );

        return {
          type: "file" as const,
          file: {
            fileKey,
            mimeType: "text/markdown",
            fileName: `ocr_${index}.md`,
          },
        };
      })
    );

    logger.info(`Returning ${files.length} markdown files`);

    // Save the markdown files to disk
    for (const [index, file] of files.entries()) {
      const fileData = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: file.file?.fileKey,
        })
      );
      const markdownData = await fileData.Body?.transformToString();

      if (!markdownData) {
        throw new Error("No data found");
      }

      await fs.writeFile(`./logs/ocr_${index}.md`, markdownData);
    }

    return {
      markdownFiles: files,
    };
  },
});

const stepFive = createStep({
  id: "stepFive",
  inputSchema: z.object({
    markdownFiles: z.array(WorkflowRunStepOutputSchema),
  }),
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData }) => {
    logger.info("Running step five");
    const { markdownFiles } = inputData;
    logger.info(`Markdown files: ${markdownFiles.length}`);

    // Load all the markdown files
    const markdownFilesContent = await Promise.all(
      markdownFiles.map(async (mdFile) => {
        const file = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME!,
            Key: mdFile.file?.fileKey,
          })
        );
        const markdownData = await file.Body?.transformToString();

        if (!markdownData) {
          throw new Error("No data found");
        }

        return markdownData;
      })
    );

    logger.info(`Markdown files content: ${markdownFilesContent.length}`);
    logger.info(markdownFilesContent[0]);

    // Use llm to create a totalized BOM from the ocr results
    const totalizedBom = await generateObject({
      model: google("gemini-2.5-pro-exp-03-25"),
      schema: z.object({
        windowAndDoorScheduleCsvContent: z.string(),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Your task is to too read the text extracted from the window and door schedule tables and create a CSV file that contains the data from the tables.

Steps:
1. Analyze the cropped images of the window and door schedule tables.
2. Extract the data from the tables and save it as a CSV file.

Output Format:
Generate a CSV artifact with proper escaping using the following structure:

Example of correct CSV formatting:
"WINDOW SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"A","8'-0""","2'-4""","18.67"
"B","4'-8""","2'-8""","12.44"

"DOOR SCHEDULE"
"Item","Height","Width","Area (sq ft)"
"01A","8'-0""","3'-0""","24.00"
"01B","8'-0""","3'-0""","24.00"

CSV Formatting Rules:
1. Every field must be enclosed in double quotes: "field"
2. For measurements containing inches ("), add an additional " before the inches: "8'-0"""
3. Separate fields with single commas (no spaces): "field1","field2"
4. Each schedule should start with its title on a separate line
5. Headers should be quoted: "Item","Height","Width","Area (sq ft)"

Example of a single properly formatted line:
"A","8'-0""","2'-4""","18.67"

Quality Control:
- Verify all measurements are properly formatted (X'-Y""")
- Confirm area calculations are accurate and rounded
- Ensure unique identifiers are consistent and logical
- Validate that no required data fields are missing
- Check that all fields are properly quoted and escaped

Return only the final CSV in the specified format, without any additional commentary or markup.

Do not make up any information. Only include information that is present in the cropped images. If you are unsure about a measurement or detail, indicate it as "unknown" in the output. Do not attempt to fill in gaps with assumptions or estimates.`,
            },
            {
              type: "text",
              text: `Here are the individual BOM tables that you need to consolidate:\n\n ${markdownFilesContent.join("\n\n\n")}`,
            },
          ],
        },
      ],
    });
    logger.info(
      `Totalized BOM: ${totalizedBom.object.windowAndDoorScheduleCsvContent}`
    );

    const windowAndDoorScheduleCsvContent =
      totalizedBom.object.windowAndDoorScheduleCsvContent;

    const fileKey = `uploads/window-door-schedule.csv`;

    // Upload the totalized BOM CSV to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
        Body: Buffer.from(windowAndDoorScheduleCsvContent, "utf-8"),
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
        fileName: "window-door-schedule.csv",
        fileUrl: presignedUrlString,
      },
    };

    return {
      windowAndDoorScheduleCsvFile: csvFile,
    };
  },
});

// Build the workflow
const windowDoorScheduleGen = createWorkflow({
  id: "window-door-schedule-gen",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne, stepTwo, stepThree, stepFour, stepFive],
})
  .then(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .then(stepFour)
  .then(stepFive)
  .commit();

export { windowDoorScheduleGen };
