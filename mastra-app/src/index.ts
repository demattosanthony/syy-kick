import "dotenv/config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";

import s3 from "./s3.ts";
import { mastra } from "./mastra/index.ts";

const homeDir = process.env.HOME;

const filePath = `${homeDir}/workflows-dataset/bom-consolidator/Blue Halo/WorkingAB_BlueHalo_CtrlDwgs_03282025.pdf`;

const fileKey = "uploads/WorkingAB_BlueHalo_CtrlDwgs_03282025.pdf";
const data = await fs.readFile(filePath);

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: fileKey,
    Body: data,
  })
);

const workflow = mastra.vnext_getWorkflow("totalized-bom-builder");
const run = workflow.createRun();

const res = await run.start({
  inputData: {
    controlsDrawings: {
      type: "file",
      value: {
        fileKey,
        mimeType: "application/pdf",
        fileName: "WorkingAB_BlueHalo_CtrlDwgs_03282025.pdf",
      },
    },
  },
});

console.log(JSON.stringify(res, null, 2));
