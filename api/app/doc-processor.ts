// Node built-ins
import os from "os";
import path from "node:path";

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
import { CONFIG } from "./config/constants";

// Define constants
const SUPER_CHUNK_SIZE = 105_000;
const EMBEDDING_BATCH_SIZE = 100;

interface DocumentChunk {
  markdown: string;
  contextualSummary?: string;
  metadata?: {
    page_number?: number;
  };
  imageFileKey?: string;
}

interface ProcessFileOptions {
  fileKey: string;
  fileName: string;
  mimeType: string;
  documentId: string;
  debug?: boolean;
}

export const ACCEPTED_DOC_PROCESSING_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".xls",
  ".xlsx",
  ".pptx",
  ".ppt",
  ".html",
  ".csv",
  ".json",
  ".xml",
  ".zip",
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".mid",
  ".midi",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mpeg",
  ".mpg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico",
  ".heic",
  ".md",
  ".txt",
  ".rtf",
];
export async function processFile({
  fileKey,
  fileName,
  mimeType,
  documentId,
  debug = false,
}: ProcessFileOptions) {
  try {
    const extension = "." + (fileName.split(".").pop()?.toLowerCase() || "");

    if (debug) {
      console.log("Processing file:", fileName);
      console.log("Mime type:", mimeType);
    }

    // Check if we can process the file
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

    let documentChunks: DocumentChunk[] = [];

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1024,
      chunkOverlap: 20,
    });

    // Process different file types
    try {
      if (mimeType === "application/pdf") {
        const result = await mistralOcr(
          Buffer.from(fileContent).toString("base64"),
          mimeType
        );
        let markdown = "";
        for (const page of result.pages) {
          markdown += page.markdown || "";

          // Process images in batches of 5
          const batchSize = 5;
          for (let i = 0; i < page.images.length; i += batchSize) {
            const batch = page.images.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(async (image) => {
                if (!image.imageBase64) {
                  return null;
                }

                const imageFileKey = `${fileKey}-${Date.now()}.jpeg`;
                await s3.write(imageFileKey, Buffer.from(image.imageBase64));
                const imageMarkdown = await imageToMarkdown(
                  image.imageBase64,
                  "image/jpeg"
                );

                if (debug) {
                  console.log("Image markdown:", imageMarkdown);
                }

                return {
                  markdown: sanitizeText(imageMarkdown),
                  imageFileKey,
                };
              })
            );

            // Filter out nulls and add to documentChunks
            documentChunks.push(...batchResults.filter((r) => r !== null));

            // Add delay between batches except for last batch
            if (i + batchSize < page.images.length) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
        const chunks = await textSplitter.splitText(markdown);
        documentChunks.push(
          ...chunks.map((chunk) => ({
            markdown: sanitizeText(chunk),
          }))
        );
      } else if (mimeType.startsWith("image/")) {
        const markdown = await imageToMarkdown(
          Buffer.from(fileContent).toString("base64"),
          mimeType
        );
        const imageFileKey = `${fileKey}-${Date.now()}.${extension}`;
        await s3.write(imageFileKey, Buffer.from(fileContent));
        documentChunks.push({
          markdown: sanitizeText(markdown),
          imageFileKey,
        });
      } else {
        const text = await markitdown(fileContent, fileName);
        const chunks = await textSplitter.splitText(text);
        documentChunks.push(
          ...chunks.map((chunk) => ({
            markdown: sanitizeText(chunk),
          }))
        );
      }
    } catch (error) {
      throw new Error(
        `Failed to process file content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (debug) {
      console.log("Document chunks:", documentChunks);
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

    let contextualizedChunks;
    try {
      contextualizedChunks = await addContextToChunks(
        superChunks,
        documentChunks
      );
    } catch (error) {
      throw new Error(
        `Failed to add context to chunks: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (debug) {
      console.log("Contextualized chunks:", contextualizedChunks);
    }

    // Generate embeddings for the chunk + contextual summary
    // Do this in batches because of API rate limits
    const values = contextualizedChunks.map(
      (c) => c.markdown + "\n\n" + c.contextualSummary
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

async function processUnstructured(
  fileContent: ArrayBuffer,
  fileName: string,
  mimeType: string
) {
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

  return response;
}

/**
 * Process a pdf file with mistral ocr
 * @param base64 - The base64 encoded file content
 * @param mimeType - The mime type of the file
 */
async function mistralOcr(
  base64: string,
  mimeType: string
): Promise<OCRResponse> {
  try {
    const result = await mistralAi.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        documentUrl: `data:${mimeType};base64,${base64}`,
        type: "document_url",
      },
      includeImageBase64: false,
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
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are an advanced OCR and image analysis model. Your task is to meticulously analyze the provided image and extract ALL information present, including text, numbers, and structural elements like tables. Format the extracted information strictly as markdown. If the image contains tables, represent them accurately using markdown table syntax. If the image depicts an object (e.g., equipment, a scene), describe it in detail, identifying specific components, labels, text, and potentially assessing its condition based on visual evidence. Output ONLY the markdown representation of the image content. Do not include any introductory phrases, explanations, or text like 'Here is the markdown representation' or 'The image contains...'. DO NOT wrap the markdown in ```markdown tags, just output the markdown.",
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
