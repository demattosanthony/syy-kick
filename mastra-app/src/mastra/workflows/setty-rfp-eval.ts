import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows/vNext";

import type {
  WorkflowExecutionInputValues,
  WorkflowFile,
} from "../../types.ts";
import { settyRfpEvaluator } from "../agents/index.ts";
import { getFileFromS3, uploadFileToS3, getPresignedUrl } from "../../s3.ts";
import { randomUUID } from "node:crypto";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  rfpPdf: z.object({
    type: z.literal("file"),
    label: z.literal("RFP PDF"),
    value: z.object({
      fileKey: z.string(),
      mimeType: z.literal("application/pdf"),
      fileName: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  settyRfpEval: z.object({
    type: z.literal("file"),
    file: z.object({
      fileKey: z.string(),
      mimeType: z.string(),
      fileName: z.string(),
      url: z.string().optional(),
    }),
  }),
});

const stepOne = createStep({
  id: "stepOne",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const rfpPdf = inputData.rfpPdf;
    const { fileKey } = rfpPdf.value as WorkflowFile;

    // Get the file from S3
    const file = await getFileFromS3(fileKey);
    const fileData = await file.Body?.transformToByteArray();
    if (!fileData) {
      throw new Error("File not found");
    }
    const base64 = Buffer.from(fileData).toString("base64");

    const { object } = await settyRfpEvaluator.generate(
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Evaluate this RFP. Only output the CSV content. Do not include any other text or comments.",
            },
            {
              type: "file",
              data: base64,
              mimeType: "application/pdf",
            },
          ],
        },
      ],
      {
        output: z.object({
          csvContent: z.string(),
        }),
      }
    );
    const csvContent = object.csvContent;

    // Upload the CSV content to S3
    const csvFileKey = `workflows/${randomUUID()}/${randomUUID()}/setty-rfp-eval.csv`;
    const csvFileData = Buffer.from(csvContent, "utf-8");
    await uploadFileToS3(csvFileKey, csvFileData, "text/csv");

    // Get the presigned URL for the CSV file
    const presignedUrlString = await getPresignedUrl(csvFileKey);

    return {
      settyRfpEval: {
        type: "file" as const,
        file: {
          fileKey: csvFileKey,
          mimeType: "text/csv",
          fileName: "setty-rfp-eval.csv",
          url: presignedUrlString,
        },
      },
    };
  },
});

const settyRfpEval = createWorkflow({
  id: "Setty RFP Evaluation",
  description:
    "This workflow evaluates a Request for Proposal (RFP) pdf file based on the setty criteria",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne],
})
  .then(stepOne)
  .commit();

export { settyRfpEval };
