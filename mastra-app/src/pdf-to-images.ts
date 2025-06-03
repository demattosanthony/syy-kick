import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

import { getFileFromS3, uploadFileToS3 } from "./s3.ts";

export async function convertPdfToImages(
  pdfData: Buffer,
  options?: { maxDimension?: number }
): Promise<
  {
    name: string;
    path: string;
    size: number;
    page: number;
    base64: string;
  }[]
> {
  const execAsync = promisify(exec);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-images-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const outputPattern = path.join(tempDir, "output-%d.png");

  try {
    await fs.writeFile(tempPdfPath, Buffer.from(pdfData));

    const gsCommand = `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r400 -sOutputFile="${outputPattern}" "${tempPdfPath}"`;

    await execAsync(gsCommand);

    const imageFiles = await fs.readdir(tempDir);
    const images = [];

    for (const imageFile of imageFiles) {
      if (imageFile.startsWith("output-") && imageFile.endsWith(".png")) {
        const imagePath = path.join(tempDir, imageFile);

        // Resize the image if maxDimension is provided
        if (options?.maxDimension && options.maxDimension > 0) {
          const resizeCommand = `convert "${imagePath}" -resize "${options.maxDimension}x${options.maxDimension}>" "${imagePath}"`;
          try {
            await execAsync(resizeCommand);
          } catch (resizeError) {
            console.error(`Failed to resize image ${imageFile}:`, resizeError);
            // Optionally, decide if you want to throw or continue without resizing
            // For now, we log and continue, the original image will be used.
          }
        }

        const pageMatch = imageFile.match(/output-(\d+)\.png/);
        const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 0;

        const imageBuffer = await fs.readFile(imagePath);
        const stats = await fs.stat(imagePath);

        images.push({
          name: imageFile,
          path: imagePath,
          size: stats.size,
          page: pageNum,
          base64: imageBuffer.toString("base64"),
        });
      }
    }

    await fs.rm(tempDir, { recursive: true, force: true });

    // Sort images by page number to ensure correct order
    images.sort((a, b) => a.page - b.page);

    return images;
  } catch (error) {
    console.error(error);
    // Delete the temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export async function convertPdfFromS3ToImages(
  fileKey: string,
  workflowId: string,
  workflowRunId: string,
  options: { maxDimension: number } = { maxDimension: 8000 }
): Promise<
  {
    type: "file";
    file: {
      fileKey: string;
      mimeType: string;
      fileName: string;
    };
  }[]
> {
  // Download PDF from S3
  const file = await getFileFromS3(fileKey);
  const pdfData = await file.Body?.transformToByteArray();

  if (!pdfData) {
    throw new Error("No data found");
  }

  // Convert PDF to images
  const images = await convertPdfToImages(Buffer.from(pdfData), options);

  // Upload images to S3
  const uploadPromises = images.map((image) => {
    const uploadFileKey = `workflows/${workflowId}/${workflowRunId}/${image.name}`;
    return uploadFileToS3(
      uploadFileKey,
      Buffer.from(image.base64, "base64"),
      "image/png"
    ).then(() => ({
      type: "file" as const,
      file: {
        fileKey: uploadFileKey,
        mimeType: "image/png",
        fileName: image.name,
      },
    }));
  });

  return Promise.all(uploadPromises);
}
