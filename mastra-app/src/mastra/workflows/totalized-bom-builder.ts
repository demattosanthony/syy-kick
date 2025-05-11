import { Step, Workflow } from "@mastra/core/workflows";
import { z } from "zod";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generateObject } from "ai";
import fs from "fs/promises";

import { convertPdfToImages } from "../../pdf-to-images.ts";
import { objectDetection } from "../../obj-detection.ts";
import s3 from "../../s3.ts";
import logger from "../../logger.ts";
import { openai } from "@ai-sdk/openai";

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
    const pdfData = await file.Body?.transformToByteArray();

    if (!pdfData) {
      throw new Error("No data found");
    }

    const images = await convertPdfToImages(Buffer.from(pdfData));

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
          })
        )
        .then(() => fileKey);
    });

    const uploadedFileKeys = await Promise.all(uploadPromises);

    logger.info(`Uploaded ${uploadedFileKeys.length} images to S3`);

    return {
      uploadedFileKeys,
    };
  },
});

type StepOneOutput = {
  uploadedFileKeys: string[];
};

const stepTwo = new Step({
  id: "stepTwo",
  execute: async ({ context }) => {
    const { uploadedFileKeys } =
      context.getStepResult<StepOneOutput>("stepOne");

    const images = await Promise.all(
      uploadedFileKeys.map(async (fileKey) => {
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

        return {
          fileKey,
          base64: Buffer.from(pdfData).toString("base64"),
        };
      })
    );
    let fileKeysWithBomTables = [];

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

    fileKeysWithBomTables = images
      .filter((_, index) => results[index].object.hasBomTable)
      .map((image) => image.fileKey);

    console.log(
      "Number of images with BOM tables: ",
      fileKeysWithBomTables.length
    );

    return {
      fileKeysWithBomTables,
    };
  },
});

type StepTwoOutput = {
  fileKeysWithBomTables: string[];
};

const stepThree = new Step({
  id: "stepThree",
  execute: async ({ context }) => {
    const { fileKeysWithBomTables } =
      context.getStepResult<StepTwoOutput>("stepTwo");

    // Load images that have BOM tables on them
    const images = await Promise.all(
      fileKeysWithBomTables.map(async (fileKey) => {
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

        return {
          fileKey,
          base64: Buffer.from(pdfData).toString("base64"),
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

    const croppedImageFileKeys = flattenedCroppedImages.map(
      (image) => `uploads/${image.fileName}`
    );

    // Log presigned urls for the cropped images
    for (const fileKey of croppedImageFileKeys) {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: fileKey,
      });
      const presignedUrlString = await getSignedUrl(s3, command, {
        expiresIn: 3600,
      }); // Expires in 1 hour
      logger.info(`Presigned url for ${fileKey}: ${presignedUrlString}`);
    }

    return {
      croppedImageFileKeys,
    };
  },
});

// Build the workflow
const totalizedBomBuilder = new Workflow({
  name: "totalized-bom-builder",
  triggerSchema: z.object({
    fileKey: z.string(),
  }),
})
  .step(stepOne)
  .then(stepTwo)
  .then(stepThree)
  .commit();

export { totalizedBomBuilder };
