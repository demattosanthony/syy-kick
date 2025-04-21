// Node built-ins
import os from "os";
import path from "node:path";
import crypto from "node:crypto";

// Database and schema
import db from "./config/db";
import { documentEmbeddings } from "./config/schema";

// AI/ML models and services
import {
  mistralAi,
  MODELS,
  smallOpenaiEmbeddingModel,
} from "./features/models";
import { embedMany, generateText } from "ai";

// Storage
import s3 from "./config/s3";

// Text processing
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Types and constants
import { OCRResponse } from "@mistralai/mistralai/models/components";
import { encoding_for_model } from "tiktoken";
import unstructured from "./config/unstructured";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { ACCEPTED_DOC_PROCESSING_EXTENSIONS, CONFIG } from "./config/constants";

// Define constants
const SUPER_CHUNK_SIZE = 400_000;
const EMBEDDING_BATCH_SIZE = 100;
const PDF_IMAGE_PROCESSING_BATCH_SIZE = 5;
const PDF_IMAGE_PROCESSING_DELAY_MS = 1000;

interface DocumentChunk {
  markdown: string;
  contextualSummary?: string;
  metadata?: {
    page_number?: number;
  };
  imageFileKey?: string;
  debug?: boolean;
  addContextualSummaries?: boolean;
}

interface ProcessFileOptions {
  fileKey: string;
  fileName: string;
  mimeType: string;
  documentId: string;
  debug?: boolean;
  addContextualSummaries?: boolean;
}

type FileProcessor = (params: {
  fileContent: ArrayBuffer;
  fileName: string;
  fileKey: string;
  mimeType: string;
  extension: string;
  textSplitter: RecursiveCharacterTextSplitter;
  debug: boolean;
}) => Promise<DocumentChunk[]>;

// Processor for PDF files
const processPdf: FileProcessor = async ({
  fileContent,
  fileKey,
  mimeType,
  textSplitter,
  debug,
}) => {
  let documentChunks: DocumentChunk[] = [];
  const base64 = Buffer.from(fileContent).toString("base64");

  const result = await mistralOcr({
    base64,
    mimeType,
    includeImages: false,
  });

  let combinedMarkdown = "";
  for (const page of result.pages) {
    combinedMarkdown += page.markdown || "";

    // Process images in batches
    for (
      let i = 0;
      i < page.images.length;
      i += PDF_IMAGE_PROCESSING_BATCH_SIZE
    ) {
      const batch = page.images.slice(i, i + PDF_IMAGE_PROCESSING_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (image) => {
          if (!image.imageBase64) return null;

          const imageFileKey = `${fileKey}-img-${crypto.randomUUID()}.jpeg`;
          await s3.write(
            imageFileKey,
            Buffer.from(image.imageBase64, "base64")
          );
          const imageMarkdown = await imageToMarkdown(
            image.imageBase64,
            "image/jpeg"
          );

          if (debug) {
            console.log("(PDF Image) Image markdown:", imageMarkdown);
          }

          // Explicitly return type compatible with DocumentChunk
          const chunkData: DocumentChunk = {
            markdown: sanitizeText(imageMarkdown),
            imageFileKey,
          };
          return chunkData;
        })
      );

      documentChunks.push(
        ...batchResults.filter((r): r is DocumentChunk => r !== null)
      );

      // Add delay between batches except for last batch
      if (i + PDF_IMAGE_PROCESSING_BATCH_SIZE < page.images.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, PDF_IMAGE_PROCESSING_DELAY_MS)
        );
      }
    }
  }

  const textChunks = await textSplitter.splitText(combinedMarkdown);
  documentChunks.push(
    ...textChunks.map((chunk) => ({
      markdown: sanitizeText(chunk),
    }))
  );

  return documentChunks;
};

// Processor for Image files
const processImage: FileProcessor = async ({
  fileContent,
  fileName,
  fileKey,
  mimeType,
  extension,
  debug,
}) => {
  const base64 = Buffer.from(fileContent).toString("base64");
  const markdown = await imageToMarkdown(base64, mimeType);
  const imageFileKey = `${fileKey}-img-${crypto.randomUUID()}${extension}`;

  // Save the original image file to S3 associated with the chunk
  await s3.write(imageFileKey, Buffer.from(fileContent));

  if (debug) {
    console.log("(Image File) Image markdown:", markdown);
  }

  return [
    {
      markdown: sanitizeText(markdown),
      imageFileKey,
    },
  ];
};

// Processor for Generic files (using markitdown)
const processGeneric: FileProcessor = async ({
  fileContent,
  fileName,
  textSplitter,
  debug,
}) => {
  if (debug) {
    console.log(`Processing generic file ${fileName} with markitdown`);
  }
  const text = await markitdown(fileContent, fileName);
  const chunks = await textSplitter.splitText(text);
  return chunks.map((chunk) => ({
    markdown: sanitizeText(chunk),
  }));
};

// Map of processors
const fileProcessors: [(mime: string) => boolean, FileProcessor][] = [
  [(mime) => mime === "application/pdf", processPdf],
  [(mime) => mime.startsWith("image/"), processImage],
  [(mime) => true, processGeneric],
];

// Function to get the appropriate processor
function getProcessor(mimeType: string): FileProcessor {
  for (const [predicate, processor] of fileProcessors) {
    if (predicate(mimeType)) {
      return processor;
    }
  }
  // Should theoretically be unreachable due to the default processor
  return processGeneric;
}

export async function processFile({
  fileKey,
  fileName,
  mimeType,
  documentId,
  debug = false,
  addContextualSummaries = true,
}: ProcessFileOptions) {
  try {
    const extension = "." + (fileName.split(".").pop()?.toLowerCase() || "");

    if (debug) {
      console.log("Processing file:", fileName);
      console.log("Mime type:", mimeType);
      console.log("Extension:", extension);
    }

    // Check if we can process the file extension
    if (!ACCEPTED_DOC_PROCESSING_EXTENSIONS.includes(extension)) {
      console.log(`Skipping unsupported file extension: ${extension}`);
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    // Read the file content
    let fileContent: ArrayBuffer;
    try {
      fileContent = await s3.file(fileKey).arrayBuffer();
    } catch (error) {
      throw new Error(
        `Failed to read file from S3: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1024,
      chunkOverlap: 20,
    });

    let documentChunks: DocumentChunk[] = [];

    // Process file content using the appropriate processor
    try {
      const processor = getProcessor(mimeType);
      documentChunks = await processor({
        fileContent,
        fileName,
        fileKey,
        mimeType,
        extension,
        textSplitter,
        debug,
      });
    } catch (error) {
      throw new Error(
        `Failed to process file content using ${mimeType} processor: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (debug) {
      console.log("Initial document chunks count:", documentChunks.length);
    }

    if (documentChunks.length === 0) {
      throw new Error("No document chunks were generated from the file");
    }

    const superChunks = createSuperChunks(
      documentChunks.map((chunk) => chunk.markdown).join("\n\n"),
      SUPER_CHUNK_SIZE
    );

    if (debug) {
      console.log("Number of super chunks:", superChunks.length);
    }

    let contextualizedChunks: DocumentChunk[] = [];

    if (addContextualSummaries) {
      try {
        contextualizedChunks = await addContextToChunks(
          superChunks,
          documentChunks
        );
      } catch (error) {
        console.warn(
          `Failed to add context to chunks, proceeding without contextual summaries: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        // Fallback: Use original chunks without context
        contextualizedChunks = documentChunks.map((chunk) => ({
          ...chunk,
          contextualSummary: undefined,
        }));
      }
    } else {
      // If not adding context, use the original chunks directly
      contextualizedChunks = documentChunks.map((chunk) => ({
        ...chunk,
        contextualSummary: undefined,
      }));
      if (debug) {
        console.log(
          "Skipping contextual summary generation as per configuration."
        );
      }
    }

    if (debug) {
      console.log("Contextualized chunks:", contextualizedChunks);
    }

    // Generate embeddings for the chunk (+ contextual summary if available)
    // Do this in batches because of API rate limits
    const values = contextualizedChunks.map(
      (c) =>
        c.markdown + (c.contextualSummary ? "\n\n" + c.contextualSummary : "")
    );
    let allEmbeddings = [];

    try {
      // Generate all embeddings in batches
      for (let i = 0; i < values.length; i += EMBEDDING_BATCH_SIZE) {
        const batchValues = values.slice(i, i + EMBEDDING_BATCH_SIZE);
        const { embeddings } = await embedMany({
          model: smallOpenaiEmbeddingModel,
          values: batchValues,
        });

        // Check if the embedding service returned the expected number for the batch
        if (embeddings.length !== batchValues.length) {
          throw new Error(
            `Embedding service returned ${embeddings.length} embeddings for a batch of size ${batchValues.length}`
          );
        }
        allEmbeddings.push(...embeddings);
      }

      // Final check after generating all embeddings
      if (contextualizedChunks.length !== allEmbeddings.length) {
        throw new Error(
          `Mismatch between total chunks (${contextualizedChunks.length}) and total generated embeddings (${allEmbeddings.length})`
        );
      }

      // Insert all embeddings into the database in one go
      if (contextualizedChunks.length > 0) {
        try {
          await db.insert(documentEmbeddings).values(
            contextualizedChunks.map((chunk, index) => ({
              documentId,
              text: chunk.markdown,
              contextualSummary: chunk.contextualSummary,
              embedding: allEmbeddings[index],
              metadata: chunk.metadata,
              imageFileKey: chunk.imageFileKey,
            }))
          );
        } catch (error) {
          throw new Error(
            `Failed to insert embeddings into database: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    } catch (error) {
      // Catch errors from embedding generation OR insertion
      throw new Error(
        `Failed to generate or store embeddings: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    console.log("Successfully processed the file:", fileName);

    return contextualizedChunks;
  } catch (error) {
    console.error(`Error processing file ${fileName}:`, error);
    throw error; // Re-throw to be handled by the job queue
  }
}

/**
 * Process a pdf file with unstructured
 * @param fileContent - The file content as an ArrayBuffer
 * @param fileName - The name of the file
 */
async function processUnstructured(
  fileContent: ArrayBuffer,
  fileName: string
): Promise<DocumentChunk[]> {
  const response = await unstructured.general.partition({
    partitionParameters: {
      files: {
        content: fileContent,
        fileName: fileName,
      },
      strategy: CONFIG.__prod__ ? Strategy.HiRes : Strategy.Fast,
      splitPdfPage: true,
      splitPdfAllowFailed: true,
      splitPdfConcurrencyLevel: 5,
      maxCharacters: 2000,
      combineUnderNChars: 500,
      overlap: 200,
      coordinates: true,
      includeOrigElements: false,
      chunkingStrategy: "by_title",
    },
  });

  const chunks = response.elements?.map((element) => ({
    markdown: element.text || "",
    metadata: {
      page_number: element.metadata?.page_number,
    },
  }));

  return chunks || [];
}

interface MistralOcrInput {
  base64: string;
  mimeType: string;
  includeImages?: boolean;
}

/**
 * Process a pdf file with mistral ocr
 * @param input - The input parameters for OCR processing
 */
async function mistralOcr({
  base64,
  mimeType,
  includeImages = true,
}: MistralOcrInput): Promise<OCRResponse> {
  try {
    const result = await mistralAi.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        documentUrl: `data:${mimeType};base64,${base64}`,
        type: "document_url",
      },
      includeImageBase64: includeImages,
    });

    if (!result) {
      throw new Error("OCR processing returned no result");
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Mistral OCR processing failed: ${errorMessage}`);
  }
}

/**
 * Process a pdf file with microsofts Markitdown CLI tool
 * @param fileContent - The file content as an ArrayBuffer
 */
export async function markitdown(
  fileContent: ArrayBuffer,
  fileName: string
): Promise<string> {
  const tempPath = path.join(os.tmpdir(), fileName);

  try {
    // Save to temp path
    await Bun.write(tempPath, fileContent);

    // Process with markitdown
    const proc = Bun.spawn(["markitdown", tempPath]);
    if (!proc.pid) {
      throw new Error("Failed to spawn markitdown process");
    }

    const result = await new Response(proc.stdout).text();
    if (!result) {
      throw new Error("Markitdown produced no output");
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Markitdown processing failed: ${errorMessage}`);
  } finally {
    // Clean up temp file
    try {
      await Bun.file(tempPath).delete();
    } catch (error) {
      console.warn(`Failed to delete temp file ${tempPath}:`, error);
    }
  }
}

/**
 * Create a text description of an image
 */
async function imageToMarkdown(
  base64: string,
  mimeType: string
): Promise<string> {
  try {
    const { text } = await generateText({
      model: MODELS["gpt-4o-mini"].model,
      temperature: 0,
      maxTokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an advanced OCR and image analysis model. Your task is to analyze the provided image and extract ONLY the information explicitly visible within it, such as text, numbers, and structural elements like tables. Do not infer, guess, or add any information not directly present in the image. Format the extracted information strictly as markdown. If the image contains tables, represent them accurately using markdown table syntax based ONLY on the visible table structure and content. If the image depicts an object, describe only its visible components, labels, and text. Do not assess its condition or make assumptions about its function unless explicitly stated in the image. Output ONLY the markdown representation of the visible image content. Do not include any introductory phrases, explanations, or text like 'Here is the markdown representation' or 'The image contains...'. DO NOT wrap the markdown in ```markdown tags, just output the markdown.",
            },
            {
              image: base64,
              type: "image",
              mimeType: mimeType,
            },
          ],
        },
      ],
    });
    return text;
  } catch (error) {
    throw new Error(`Error processing image: ${error}`);
  }
}

/**
 * Split the full document text into super chunks of approximately maxTokens
 * @param fullText The full document text
 * @param maxTokens Maximum number of tokens per super chunk
 * @returns Array of super chunks with their token counts and start positions
 */
export function createSuperChunks(fullText: string, maxTokens: number) {
  // Get the encoder for the model we're using
  const enc = encoding_for_model("gpt-4o-mini");

  try {
    // Encode the full text to get tokens
    const tokens = enc.encode(fullText);
    const totalTokens = tokens.length;
    console.log(`Total document tokens: ${totalTokens}`);

    // Calculate optimal chunk size to distribute tokens more evenly
    const numChunks = Math.ceil(totalTokens / maxTokens);
    const optimalChunkSize = Math.ceil(totalTokens / numChunks);
    console.log(
      `Creating ${numChunks} chunks with ~${optimalChunkSize} tokens each`
    );

    const superChunks = [];
    let startTokenIdx = 0;

    // Create super chunks of approximately optimalChunkSize tokens
    while (startTokenIdx < totalTokens) {
      // Calculate the end token index for this super chunk
      const endTokenIdx = Math.min(
        startTokenIdx + optimalChunkSize,
        totalTokens
      );

      // Decode the tokens back to text for this super chunk
      const chunkTokens = tokens.slice(startTokenIdx, endTokenIdx);
      const chunkText = new TextDecoder().decode(enc.decode(chunkTokens));

      // Store the super chunk with its token count and starting position in the original text
      const startChar = fullText.indexOf(chunkText);
      superChunks.push({
        text: chunkText,
        tokenCount: chunkTokens.length,
        startChar: startChar,
        endChar: startChar + chunkText.length,
      });

      startTokenIdx = endTokenIdx;
    }

    return superChunks;
  } finally {
    // Free the encoder
    enc.free();
  }
}

/**
 * Find the most appropriate super chunk for a given text chunk
 * @param superChunks Array of super chunks
 * @param chunkText Text of the chunk to find context for
 * @returns The most appropriate super chunk
 */
export function findBestSuperChunk(
  superChunks: Array<{
    text: string;
    tokenCount: number;
    startChar: number;
    endChar: number;
  }>,
  chunkText: string
) {
  const chunkIndex = superChunks.findIndex((sc) => sc.text.includes(chunkText));

  if (chunkIndex !== -1) {
    // Found in a super chunk
    return superChunks[chunkIndex];
  }

  // If not found directly, find the closest super chunk
  // This handles edge cases where chunks might span super chunk boundaries
  const fullText = superChunks.map((sc) => sc.text).join("");
  const chunkPosition = fullText.indexOf(chunkText);

  if (chunkPosition === -1) {
    // If not found at all, return the first super chunk as fallback
    console.warn(
      "Chunk not found in full document, using first super chunk as fallback"
    );
    return superChunks[0];
  }

  // Find the super chunk with the closest starting position
  let closestSuperChunk = superChunks[0];
  let minDistance = Math.abs(chunkPosition - closestSuperChunk.startChar);

  for (const sc of superChunks) {
    const distance = Math.abs(chunkPosition - sc.startChar);
    if (distance < minDistance) {
      minDistance = distance;
      closestSuperChunk = sc;
    }
  }

  return closestSuperChunk;
}

async function addContextToChunks(
  superChunks: {
    text: string;
    tokenCount: number;
    startChar: number;
    endChar: number;
  }[],
  chunks: DocumentChunk[]
) {
  const batchSize = 5;
  const delayMs = 200;
  let contextualizedChunks: DocumentChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    console.log(`Processing batch starting at index ${i}`);
    const batch = chunks.slice(i, i + batchSize);

    try {
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const bestSuperChunk = findBestSuperChunk(
            superChunks,
            chunk.markdown
          );
          console.log(
            `Found best super chunk with ${bestSuperChunk.tokenCount} tokens for chunk`
          );

          const { text: context } = await generateText({
            model: MODELS["gpt-4o-mini"].model,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `<document>\n${bestSuperChunk.text}\n</document>`,
                  },
                  {
                    type: "text",
                    text: `Here is the chunk we want to situate within the whole document
<chunk>
${chunk.markdown}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else."""
`,
                  },
                ],
              },
            ],
          });

          return {
            ...chunk,
            contextualSummary: context,
          };
        })
      );

      contextualizedChunks.push(...batchResults);

      // Add delay between batches (skip delay on last batch)
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.warn(
        `Failed to process batch starting at index ${i}, using original chunks:`,
        error
      );
      contextualizedChunks.push(...batch);
    }
  }

  return contextualizedChunks;
}

/** Sanitize text to remove unwanted characters and control codes */
export function sanitizeText(text: string): string {
  // Remove null bytes
  text = text.replace(/\0/g, "");

  // Replace invalid UTF-8 characters with a replacement character
  text = text.replace(/[\uFFFD\uFFFE\uFFFF]/g, "");

  // Normalize Unicode characters
  text = text.normalize("NFKC");

  // Remove any other control characters except newlines and tabs
  text = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");

  // Remove any markdown links
  text = text.replace(/\[.*?\]\(.*?\)/g, "");

  // Remove any markdown images
  text = text.replace(/\!\[.*?\]\(.*?\)/g, "");

  // Lowercase the text
  text = text.toLowerCase();

  return text.trim();
}
