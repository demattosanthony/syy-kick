import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";

import s3 from "./s3.ts";
import { mastra } from "./mastra/index.ts";

const homeDir = process.env.HOME;

const filePath = `${homeDir}/workflows-dataset/window-door-gen/coleman-valley/250401_ColemanValleyRoadRes_PROGRESSPLANSFORSUBCOORD.pdf`;

const fileKey =
  "uploads/250401_ColemanValleyRoadRes_PROGRESSPLANSFORSUBCOORD.pdf";
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

const res = await run.start({
  inputData: {
    architecturalPdf: {
      type: "file",
      label: "Architectural PDF",
      value: {
        fileKey,
        mimeType: "application/pdf",
        fileName: "250401_ColemanValleyRoadRes_PROGRESSPLANSFORSUBCOORD.pdf",
      },
    },
  },
});

console.log(JSON.stringify(res, null, 2));
