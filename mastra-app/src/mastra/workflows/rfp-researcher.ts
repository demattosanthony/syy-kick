import { z } from "zod";

import {
  type WorkflowExecutionInputValues,
  type WorkflowTextExecutionInputValue,
} from "../../types.ts";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { webResearcher } from "../agents/web-researcher.ts";
import { getPresignedUrl, uploadFileToS3 } from "../../s3.ts";

const inputSchema: z.ZodType<WorkflowExecutionInputValues> = z.object({
  rfpType: z.object({
    type: z.literal("text"),
    label: z.literal("Type of RFP"),
    value: z.object({
      text: z.string(),
    }),
  }),
});

const finalStepOutputSchema = z.object({
  researchReport: z.object({
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
  description: "Deep research agent",
  inputSchema: inputSchema,
  outputSchema: finalStepOutputSchema,
  execute: async ({ inputData, runtimeContext }) => {
    const { rfpType } = inputData;
    const { text: rfpTypeText } =
      rfpType.value as WorkflowTextExecutionInputValue;

    const { object } = await webResearcher.generate(
      [
        {
          role: "user",
          content: `Do deep research to find the most relevant RFPs for the following type: ${rfpTypeText}.

Your final report should be in markdown format. Your report should include the relevant RFPs and the links to the RFPs.`,
        },
      ],
      {
        output: z.object({
          researchReport: z.string(),
        }),
        maxSteps: 30,
      }
    );

    const researchReport = object.researchReport;

    // Upload the research report to S3
    const fileKey = `workflows/${runtimeContext.get("workflowId")}/${runtimeContext.get("runId")}/research-report.md`;
    const researchReportFileData = Buffer.from(researchReport, "utf-8");
    await uploadFileToS3(fileKey, researchReportFileData, "text/markdown");

    const presignedUrlString = await getPresignedUrl(fileKey);

    return {
      researchReport: {
        type: "file" as const,
        file: {
          fileKey,
          mimeType: "text/markdown",
          fileName: "research-report.md",
          url: presignedUrlString,
        },
      },
    };
  },
});

const rfpResearcherWorkflow = createWorkflow({
  id: "RFP Researcher",
  description: "Research the RFP",
  inputSchema,
  outputSchema: finalStepOutputSchema,
  steps: [stepOne],
})
  .then(stepOne)
  .commit();

export { rfpResearcherWorkflow };
