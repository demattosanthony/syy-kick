import "dotenv/config";
import { totalizedBomBuilder } from "./mastra/workflows/totalized-bom-builder.ts";
import s3 from "./s3.ts";
import fs from "node:fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const { start } = totalizedBomBuilder.createRun();

const filePath =
  "/Users/anthonydemattos/workflows-dataset/bom-consolidator/rev1-rod-n-reel/Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf";

const fileKey =
  "uploads/1715516551560-Rev1_RodnReelCasino_CtrlDwgs_04222025.pdf";
const data = await fs.readFile(filePath);

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: fileKey,
    Body: data,
  })
);

const res = await start({
  triggerData: {
    fileKey,
  },
});

console.log(JSON.stringify(res, null, 2));
