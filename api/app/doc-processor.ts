import { embedMany, generateText } from "ai";
import { CONFIG } from "./config/constants";
import s3 from "./config/s3";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { MODELS, smallOpenaiEmbeddingModel } from "./features/models";
import { documentEmbeddings } from "./config/schema";
import db from "./config/db";
import { encoding_for_model, TiktokenModel } from "tiktoken";
import unstructured, {
  ALLOWED_UNSTRUCTURED_EXTENSIONS,
} from "./config/unstructured";

const encoderCache = new Map<
  TiktokenModel,
  ReturnType<typeof encoding_for_model>
>();

function getEncoder(modelName: TiktokenModel) {
  if (!encoderCache.has(modelName)) {
    encoderCache.set(modelName, encoding_for_model(modelName));
  }
  return encoderCache.get(modelName)!;
}

export function freeEncoders() {
  for (const enc of encoderCache.values()) {
    try {
      enc.free();
    } catch (error) {
      console.warn("Error while freeing encoder:", error);
    }
  }
  encoderCache.clear(); // Clear the cache after freeing
}

export async function processFile(
  fileKey: string,
  fileName: string,
  mimeType: string,
  documentId: string
) {
  try {
    // Determine extension (fallback to empty if no '.'):
    const extension = (() => {
      const dotIndex = fileName.lastIndexOf(".");
      return dotIndex > -1 ? fileName.slice(dotIndex).toLowerCase() : "";
    })();

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
        splitPdfConcurrencyLevel: 15,
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

    // Prepare chunks and full document text
    const chunks = response.elements.map((e) => ({
      ...e,
      text: sanitizeText(e.text),
    })) as typeof response.elements;
    const fullDocumentText = chunks.map((c) => c.text).join("\n");

    // Add context to chunks
    const contextualizedChunks = await addContextToChunks(
      fullDocumentText,
      chunks
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
  fullDocument: string,
  chunks: {
    [k: string]: any;
  }[]
) {
  const encoder = getEncoder("gpt-4o-mini");
  const batchSize = 5; // Process 5 chunks at a time to stay under API limits
  const delayMs = 200; // 200ms delay between batches to avoid rate limiting
  const contextualizedChunks = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    try {
      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          const localContext = getLocalContextTiktoken(
            fullDocument,
            chunk.text,
            "gpt-4o-mini",
            90_000,
            encoder
          );
          const { text: context } = await generateText({
            model: MODELS["gpt-4o-mini"].model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `<document>\n${localContext}\n</document>`,
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
 * Returns local context around `chunk` (found in `fullText`) that stays under `maxTokens`.
 * Uses tiktoken to measure precise token count for a given model (default gpt-4o-mini).
 *
 * @param fullText - The entire text of the document.
 * @param chunk - The specific chunk we want to situate in context.
 * @param modelName - The tiktoken-compatible model name (e.g., "gpt-4o-mini").
 * @param maxTokens - Maximum allowed tokens for the returned substring (default 128,000).
 * @returns A substring of `fullText`, centered around `chunk`, that is under `maxTokens` tokens.
 */
export function getLocalContextTiktoken(
  fullText: string,
  chunk: string,
  modelName: TiktokenModel = "gpt-4o-mini",
  maxTokens = 128_000,
  encoder?: ReturnType<typeof encoding_for_model>
): string {
  const enc = encoder || getEncoder(modelName);
  const index = fullText.indexOf(chunk);

  if (index === -1) {
    return substringToMaxTokens(fullText, modelName, maxTokens, enc);
  }

  const chunkTokens = enc.encode(chunk).length;
  if (chunkTokens >= maxTokens) {
    return substringToMaxTokens(chunk, modelName, maxTokens, enc);
  }

  let start = index;
  let end = index + chunk.length;
  let bestSubstring = chunk;
  let currentTokens = chunkTokens;

  // Initial expansion with larger steps
  let step = 500;
  while (true) {
    const nextStart = Math.max(0, start - step);
    const nextEnd = Math.min(fullText.length, end + step);
    const candidate = fullText.slice(nextStart, nextEnd);
    const tokenCount = enc.encode(candidate).length;

    if (tokenCount <= maxTokens) {
      bestSubstring = candidate;
      start = nextStart;
      end = nextEnd;
      currentTokens = tokenCount;
    } else {
      break;
    }
    if (start === 0 && end === fullText.length) break;
  }

  // Fine-tuning with smaller steps
  step = 10; // Reduced step size for precision
  while (currentTokens < maxTokens) {
    let added = false;

    // Try expanding left
    if (start > 0) {
      const nextStart = Math.max(0, start - step);
      const candidateLeft = fullText.slice(nextStart, end);
      const tokenCountLeft = enc.encode(candidateLeft).length;
      if (tokenCountLeft <= maxTokens) {
        bestSubstring = candidateLeft;
        start = nextStart;
        currentTokens = tokenCountLeft;
        added = true;
      }
    }

    // Try expanding right
    if (end < fullText.length) {
      const nextEnd = Math.min(fullText.length, end + step);
      const candidateRight = fullText.slice(start, nextEnd);
      const tokenCountRight = enc.encode(candidateRight).length;
      if (tokenCountRight <= maxTokens) {
        bestSubstring = candidateRight;
        end = nextEnd;
        currentTokens = tokenCountRight;
        added = true;
      }
    }

    // Stop if no more can be added
    if (!added) break;
  }

  return bestSubstring;
}

/**
 * Returns a substring of `text` that fits within `maxTokens` for the given `modelName`.
 *
 * If `text` already fits, returns the entire text. Otherwise, returns a leading portion
 * that fits in `maxTokens`. (You could do more sophisticated middle trimming if desired.)
 */
export function substringToMaxTokens(
  text: string,
  modelName: TiktokenModel,
  maxTokens: number,
  encoder?: ReturnType<typeof encoding_for_model>
): string {
  const enc = encoder || getEncoder(modelName);
  const tokens = enc.encode(text);

  if (tokens.length <= maxTokens) {
    return text;
  }

  return new TextDecoder().decode(enc.decode(tokens.slice(0, maxTokens)));
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
