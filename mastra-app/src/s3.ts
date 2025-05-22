import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

const getFileFromS3 = async (fileKey: string) => {
  const file = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    })
  );
  return file;
};

const uploadFileToS3 = async (
  fileKey: string,
  fileData: Buffer,
  mimeType: string
) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
      Body: fileData,
      ContentType: mimeType,
    })
  );
};

const getPresignedUrl = async (fileKey: string) => {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
};

export { getFileFromS3, uploadFileToS3, getPresignedUrl };

export default s3;
