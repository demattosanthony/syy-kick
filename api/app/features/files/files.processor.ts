import os from "os";
import { mistralAi } from "../models";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import s3 from "../../config/s3";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import {
  MARKITDOWN_MIME_TYPES,
  PROGRAMMING_FILE_MIME_TYPES,
} from "../../config/constants";
import { convertPdfToImages } from "../../config/convertapi";

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 0;

export type FilePageImage = {
  name: string;
  path: string;
  size: number;
};

export type FilePageChunk = {
  content: string;
  position?: number;
  images?: FilePageImage[];
  // embeddings: number[]
};

export type FilePage = {
  pageNumber: number;
  chunks: FilePageChunk[];
  images?: FilePageImage[];
};

export type ProcessFileResult = {
  pages: FilePage[];
  category?: "drawing" | "document";
};

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

// File processing pipeline
// 1. If the file is a pdf, we want to classify it as a drawing or a document
// 2. If its a drawing, we want to turn all the pages into images
// 3. If its a document, we want to run OCR on it
// 4. If its a text file variant of a document, we use markitdown to convert it to markdown
export async function processFile(
  fileContent: Buffer,
  fileName: string,
  mimeType: string
): Promise<ProcessFileResult> {
  console.log(`📄 [ProcessFile] Processing file: ${fileName} (${mimeType})`);
  console.log(`📊 [ProcessFile] File size: ${fileContent?.length || 0} bytes`);

  if (!fileContent || fileContent.length === 0) {
    throw new Error(`File buffer is empty or null for file: ${fileName}`);
  }

  if (mimeType === "application/pdf") {
    console.log(
      `🔍 [ProcessFile] Processing PDF with ${fileContent.length} bytes`
    );

    const category = await classifyPdf(fileContent);

    // If its an engineering drawing, we want to turn all the pages into images
    if (category === "drawing") {
      const images = await convertPdfToImages(fileContent);

      const filePages: FilePage[] = [];

      for (const image of images) {
        // Upload the image to s3
        const uuid = crypto.randomUUID();
        const fileKey = `files/images/${uuid.split("-")[0]}-${image.name}`;
        const file = s3.file(fileKey);
        await file.write(Buffer.from(image.base64, "base64"), {
          type: "image/png",
        });

        filePages.push({
          pageNumber: image.page,
          chunks: [],
          images: [
            { name: image.name, path: fileKey, size: image.base64.length },
          ],
        });
      }

      return { pages: filePages, category: "drawing" };
    }

    // If its a regular pdf doc we want to run OCR on it
    if (category === "document") {
      const filePages = await processPdf(fileContent, mimeType);
      return { pages: filePages, category: "document" };
    }
  }

  // Handle plain text files directly
  if (mimeType === "text/plain") {
    const page = await processPlainText(fileContent, fileName);
    return { pages: [page], category: "document" };
  }

  // Handle programming files directly (all text-based files)
  if (PROGRAMMING_FILE_MIME_TYPES.includes(mimeType)) {
    const page = await processPlainText(fileContent, fileName);
    return { pages: [page], category: "document" };
  }

  if (MARKITDOWN_MIME_TYPES.includes(mimeType)) {
    const page = await markitdown(fileContent, fileName);
    return { pages: [page], category: "document" };
  }

  return { pages: [], category: undefined };
}

// Determine if the PDF is a engineering drawing or a regular document
// Use the first two pages to determine the category
async function classifyPdf(
  fileContent: Buffer
): Promise<"drawing" | "document"> {
  const images = await convertPdfToImages(fileContent, {
    pageRange: "1-2",
    maxDimension: 7500,
    dpi: 180,
  });

  // Validate that we got at least one image
  if (!images || images.length === 0) {
    throw new Error(
      "Failed to convert PDF to images - no images returned from ConvertAPI"
    );
  }

  // Get first two pages (or just first page if only one exists)
  const firstTwoPages = images.slice(0, 2);

  if (!firstTwoPages[0] || !firstTwoPages[0].base64) {
    throw new Error("First page conversion failed - missing base64 data");
  }

  // Prepare images for classification
  const imageContent = firstTwoPages
    .map((page, index) => [
      {
        type: "text" as const,
        text: `Here is page ${index + 1} of the pdf`,
      },
      {
        type: "image" as const,
        image: page.base64,
        mimeType: "image/png" as const,
      },
    ])
    .flat();

  const { object } = await generateObject({
    model: openai("gpt-4.1-mini"),
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that classifies pdfs into two categories: drawing and document.
The purpose of this is to determine which extraction process to run based on if its an engineering drawing or a regular document.

The first ${firstTwoPages.length} page${firstTwoPages.length > 1 ? "s" : ""} of the pdf ${firstTwoPages.length > 1 ? "are" : "is"} provided to you.

If the pdf contains engineering drawings, return "drawing".
If the pdf is a regular document, return "document".`,
      },
      {
        role: "user",
        content: imageContent,
      },
    ],
    schema: z.object({
      category: z.enum(["drawing", "document"]),
    }),
  });

  return object.category;
}

export async function markitdown(
  input: string | Buffer,
  fileName: string
): Promise<FilePage> {
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

  const expandedPath = filePath.replace(/^~(?=$|\/|\\)/, os.homedir());

  try {
    const proc = Bun.spawn(["markitdown", expandedPath]);
    const output = await new Response(proc.stdout).text();
    proc.kill();

    const chunkedOutput = await textSplitter.splitText(output);

    const page: FilePage = {
      pageNumber: 1,
      chunks: [],
    };

    for (const chunk of chunkedOutput) {
      page.chunks.push({
        content: chunk,
      });
    }

    return page;
  } finally {
    // Clean up temp file if one was created
    if (tempFile) {
      await Bun.file(tempFile).delete();
    }
  }
}

export async function processPlainText(
  fileContent: Buffer,
  fileName: string
): Promise<FilePage> {
  const textContent = fileContent.toString("utf-8");
  const chunkedContent = await textSplitter.splitText(textContent);

  const page: FilePage = {
    pageNumber: 1,
    chunks: [],
  };

  for (const chunk of chunkedContent) {
    page.chunks.push({
      content: chunk,
    });
  }

  return page;
}

export async function processPdf(
  input: Buffer,
  mimeType: string,
  includeImages: boolean = true
): Promise<FilePage[]> {
  // Convert buffer to base64 string
  const base64String = Buffer.from(input).toString("base64");

  const result = await mistralAi.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      documentUrl: `data:${mimeType};base64,${base64String}`,
      type: "document_url",
    },
    includeImageBase64: includeImages,
  });

  let filePages: FilePage[] = [];

  for (const page of result.pages) {
    const pageMarkdown = page.markdown;
    const pageImages = page.images;

    let filePage: FilePage = {
      pageNumber: page.index + 1,
      chunks: [],
    };

    // We need to chunk the markdown content and use regex to find the references to the images inside of the chunks
    const pageChunks = await textSplitter.splitText(pageMarkdown);

    for (let [index, chunk] of pageChunks.entries()) {
      let filePageChunk: FilePageChunk = {
        content: chunk,
        position: index,
      };

      // Only process images if includeImages is true
      if (includeImages) {
        // Find the images in the chunk
        // If there is an image in the chunk, it will look like this:
        // ![image_id.jpeg](image_id.jpeg)
        // We need to extract the image_id and the path to the image
        const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
        const imagesInChunk = chunk.match(imageRegex);

        if (imagesInChunk) {
          for (const image of imagesInChunk) {
            const imageId = image.split("(")[1].split(")")[0];

            // Try to find the image in the pageImages
            const foundImage = pageImages.find((img) => img.id === imageId);

            if (foundImage && foundImage.imageBase64) {
              try {
                // Extract base64 data, removing any prefix if present
                let imageBase64 = foundImage.imageBase64;
                if (imageBase64.includes(",")) {
                  imageBase64 = imageBase64.split(",", 2)[1];
                }
                const imageBuffer = Buffer.from(imageBase64, "base64");
                const uuid = crypto.randomUUID();
                const fileKey = `files/images/${uuid.split("-")[0]}-${imageId}`;

                const file = s3.file(fileKey);
                await file.write(imageBuffer, {
                  type: "image/jpeg",
                });

                filePageChunk.images = [
                  ...(filePageChunk.images || []),
                  {
                    name: foundImage.id,
                    path: fileKey,
                    size: imageBuffer.length,
                  },
                ];
              } catch (error) {
                console.error(
                  `Failed to process or upload image ${foundImage.id}:`,
                  error
                );
              }
            }
          }
        }
      }

      console.log("filePageChunk", filePageChunk);
      filePage.chunks.push(filePageChunk);
    }

    filePages.push(filePage);
  }

  return filePages;
}
