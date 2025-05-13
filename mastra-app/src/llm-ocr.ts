import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { getFileFromS3, uploadFileToS3 } from "./s3.ts";
import type { WorkflowFile, WorkflowRunStepOutput } from "./types.ts";
import { z } from "zod";

interface OcrOptions {
  tableType: string;
  columns?: string[];
  additionalInstructions?: string;
  model?: string;
}

const STANDARD_OCR_PROMPT = `Your task is to operate an OCR model to extract the text from an image. You will be given an image of a {tableType} table. You will need to extract the text from the image and return it as a string in markdown format.

Requirements:
1. Return ONLY the markdown text representing the table content
2. Do not make up any information that is not in the image
3. Use proper markdown table formatting
4. {columns}
{additionalInstructions}

The output should be a clean, well-formatted markdown table that accurately represents the content in the image.`;

/**
 * Performs OCR on images from S3 and uploads the results back to S3.
 * @param images - The images to perform OCR on.
 * @param options - The options for OCR.
 * @returns The OCR results as workflow outputs.
 */
export async function performOcrOnS3Images(
  images: WorkflowRunStepOutput[],
  options: OcrOptions,
  workflowId: string,
  workflowRunId: string
): Promise<WorkflowRunStepOutput[]> {
  // Format the prompt with the provided options
  const columns = options.columns
    ? `Only extract the following columns: ${options.columns.join(", ")}`
    : "Extract all columns present in the table";

  const prompt = STANDARD_OCR_PROMPT.replace("{tableType}", options.tableType)
    .replace("{columns}", columns)
    .replace("{additionalInstructions}", options.additionalInstructions || "");

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

  // Run OCR on all images in parallel
  const ocrResults = await Promise.all(
    loadedImages.map((image) =>
      generateObject({
        model: options.model ? openai(options.model) : openai("gpt-4.1"),
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
                text: prompt,
              },
              {
                type: "image",
                image: image.base64,
                mimeType: "image/jpeg",
              },
            ],
          },
        ],
      })
    )
  );

  // Upload OCR results to S3 and create file references
  const files = await Promise.all(
    ocrResults.map(async (result, index) => {
      const fileKey = `workflows/${workflowId}/${workflowRunId}/ocr_${index}.md`;
      const markdownFileData = Buffer.from(result.object.ocrResult, "utf-8");
      await uploadFileToS3(fileKey, markdownFileData, "text/markdown");

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

  return files;
}
