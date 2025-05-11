import { S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.S3_ENDPOINT_URL!,
  region: process.env.S3_REGION!,
  forcePathStyle: true,
});

export default s3;
