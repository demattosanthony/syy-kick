import os from "os";
import { mistralAi } from "./features/models";

export const markitdownMimeTypes = [
  //   "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "text/html",
  "text/csv",
  "application/json",
  "text/xml",
  "application/zip",
];

export const markitdown = async (input: string | Buffer, fileName: string) => {
  let filePath: string;
  let tempFile: string | null = null;

  if (Buffer.isBuffer(input)) {
    // Create temp file with random name and .pdf extension
    tempFile = `/tmp/${Date.now()}-${fileName}`;
    await Bun.write(tempFile, input);
    filePath = tempFile;
  } else {
    filePath = input;
  }
  console.log("filePath", filePath);
  const expandedPath = filePath.replace(/^~(?=$|\/|\\)/, os.homedir());

  try {
    const proc = Bun.spawn(["markitdown", expandedPath]);
    const output = await new Response(proc.stdout).text();
    return output;
  } finally {
    // Clean up temp file if one was created
    if (tempFile) {
      await Bun.file(tempFile).delete();
    }
  }
};

export const ocrIt = async (input: Buffer, mimeType: string) => {
  // Convert buffer to base64 string
  const base64String = input.toString("base64");

  const result = await mistralAi.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:${mimeType};base64,${base64String}`,
      type: "document_url",
    },
  });

  let markdown = "";
  let images = [];

  for (const [_, item] of result.pages.entries()) {
    if (item.markdown) {
      markdown += item.markdown + "\n\n";
    }

    for (let imageIndex = 0; imageIndex < item.images.length; imageIndex++) {
      const image = item.images[imageIndex];
      if (!image.imageBase64) {
        continue;
      }

      // Extract base64 data, removing any prefix if present
      let imageBase64 = image.imageBase64;
      if (imageBase64.includes(",")) {
        imageBase64 = imageBase64.split(",", 2)[1];
      }

      images.push({
        url: imageBase64,
        fileName: image.id,
        mimeType: "image/jpeg",
      });
    }
  }

  return {
    markdown,
    images,
  };
};
