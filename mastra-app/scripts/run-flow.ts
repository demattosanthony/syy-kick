// Script to test workflow runs
// Run with: node scripts/run-flow.ts (need to have node 23 installed to run ts files directly)

import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import { RuntimeContext } from "@mastra/core/runtime-context";

import s3 from "../src/s3.ts";
import { mastra } from "../src/mastra/index.ts";

const homeDir = process.env.HOME;

const filePath = `${homeDir}/workflows-dataset/window-door-gen/FrostShopPlanEC5-7-25 (1).pdf`;

const fileKey = "uploads/FrostShopPlanEC5-7-25 (1).pdf";
const data = await fs.readFile(filePath);

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: fileKey,
    Body: data,
  })
);

const workflow = mastra.vnext_getWorkflow("window-door-schedule-gen");
const run = workflow.createRun();

const context = new RuntimeContext();
context.set("workflowId", workflow.id);
context.set("runId", run.runId);

const res = await run.start({
  inputData: {
    architecturalPdf: {
      type: "file",
      label: "Architectural PDF",
      value: {
        fileKey,
        mimeType: "application/pdf",
        fileName: "FrostShopPlanEC5-7-25 (1).pdf",
      },
    },
  },
  runtimeContext: context,
});

console.log(JSON.stringify(res, null, 2));
