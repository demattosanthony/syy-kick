import { embedMany, generateText } from "ai";
import { CONFIG } from "./config/constants";
import s3 from "./config/s3";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { MODELS, smallOpenaiEmbeddingModel } from "./features/models";
import { documentEmbeddings } from "./config/schema";
import db from "./config/db";
import unstructured, {
  ALLOWED_UNSTRUCTURED_EXTENSIONS,
} from "./config/unstructured";
import { encoding_for_model } from "tiktoken";

// Define constants
const SUPER_CHUNK_SIZE = 400_000;

export async function processFile(
  fileKey: string,
  fileName: string,
  mimeType: string,
  documentId: string
) {
  try {
    // Determine extension (fallback to empty if no '.'):
    const extension = "." + (fileName.split(".").pop()?.toLowerCase() || "");

    // Now check by extension instead:
    if (!ALLOWED_UNSTRUCTURED_EXTENSIONS.includes(extension)) {
      console.log(`Skipping unsupported file extension: ${extension}`);
      throw new Error(`Unsupported file extension: ${extension}`);
    }
    // Read the file content
    const fileContent = await s3.file(fileKey).bytes();

    // Send the file to the Unstructured API for partitioning
    console.log("Processing file:", fileName);

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

    if (response.statusCode !== 200 || !response.elements) {
      throw new Error("Failed to partition file");
    }

    console.log(
      "Received response from Unstructured API for file:",
      fileName,
      "with",
      response.elements.length
    );
    console.log("CSV Response elements:", response.csvElements?.length);
    // Prepare chunks and full document text
    const chunks = response.elements.map((e) => ({
      ...e,
      text: sanitizeText(e.text),
    })) as typeof response.elements;
    const fullDocumentText = chunks.map((c) => c.text).join("\n");

    // Create token-based super chunks of the full document
    const superChunks = createSuperChunks(fullDocumentText, SUPER_CHUNK_SIZE);
    console.log(`Created ${superChunks.length} super chunks from the document`);
    console.log(
      `Token count of each super chunk: ${superChunks.map(
        (sc) => sc.tokenCount
      )}`
    );

    // Add context to chunks using the appropriate super chunk
    const contextualizedChunks = await addContextToChunks(superChunks, chunks);
    console.log(
      `Finished contextualizing ${contextualizedChunks.length} chunks`
    );

    // Generate embeddings in batches
    const values = contextualizedChunks.map((c) => c.text);
    console.log("Embedding contextualized values:", values);
    const batchSize = 100;
    let allEmbeddings = [];

    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      const { embeddings } = await embedMany({
        model: smallOpenaiEmbeddingModel,
        values: batch,
      });
      allEmbeddings.push(...embeddings);
    }

    if (contextualizedChunks.length !== allEmbeddings.length) {
      throw new Error(
        `Mismatch between chunks (${contextualizedChunks.length}) and embeddings (${allEmbeddings.length})`
      );
    }

    console.log(
      "Generated embeddings for all chunks, about to insert into database"
    );

    // Insert into database if there are chunks
    if (contextualizedChunks.length > 0) {
      await db.insert(documentEmbeddings).values(
        contextualizedChunks.map((chunk, i) => ({
          documentId,
          text: chunk.text,
          embedding: allEmbeddings[i],
          metadata:
            "metadata" in chunk && chunk.metadata ? chunk.metadata : null,
        }))
      );
    }

    console.log("Successfully processed the file:", fileName);
  } catch (error) {
    console.error(`Failed to process the file: ${error}`);
    throw new Error(`Failed to process the file: ${error}`);
  }
}

// Helper function to generate context for a chunk using GPT
async function addContextToChunks(
  superChunks: {
    text: string;
    tokenCount: number;
    startChar: number;
    endChar: number;
  }[],
  chunks: {
    [k: string]: any;
  }[]
) {
  const batchSize = 5; // Process 5 chunks at a time to stay under API limits
  const delayMs = 200; // 200ms delay between batches to avoid rate limiting
  const contextualizedChunks = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    console.log(`Processing batch starting at index ${i}`);
    const batch = chunks.slice(i, i + batchSize);

    try {
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          // Find the most appropriate super chunk for this text chunk
          const bestSuperChunk = findBestSuperChunk(superChunks, chunk.text);
          console.log(
            `Found best super chunk with ${bestSuperChunk.tokenCount} tokens for chunk`
          );

          const { text: context } = await generateText({
            model: MODELS["gpt-4.1-mini"].model,
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
                    text: `This document is related to HVAC, building engineering, and architecture.\n\n<chunk>\n${chunk.text}\n</chunk>\n\nProvide a short context to situate this chunk within the document. Consider aspects such as:
- Equipment specifications, operation procedures, or maintenance instructions
- Building systems and infrastructure
- Facility spaces, assets, or components
- Installation, testing, or commissioning details
- Safety procedures or compliance requirements
- Warranty or maintenance schedules
Answer only with the short context and nothing else.`,
                  },
                ],
              },
            ],
          });
          return { ...chunk, text: `${chunk.text}\n\n${context}` };
        })
      );
      contextualizedChunks.push(...batchResults);
    } catch (error) {
      console.warn(
        `Failed to add context to batch starting at index ${i}, using original chunks:`,
        error
      );
      contextualizedChunks.push(...batch); // Fallback to original chunks for this batch
    }

    // Add delay between batches (skip delay on the last batch)
    if (i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return contextualizedChunks;
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

  return text.trim();
}
