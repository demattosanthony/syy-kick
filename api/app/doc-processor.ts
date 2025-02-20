import { embedMany, generateText } from "ai";
import { CONFIG } from "./config/constants";
import s3 from "./config/s3";
import unstructured, {
  unstructuredApiSupportExtensions,
} from "./config/unstructured";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { MODELS, smallOpenaiEmbeddingModel } from "./features/models";
import { documentEmbeddings } from "./config/schema";
import db from "./config/db";
import { encoding_for_model, TiktokenModel } from "tiktoken";

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
    if (!unstructuredApiSupportExtensions.includes(extension)) {
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
        maxCharacters: 1024,
        combineUnderNChars: 100,
        overlap: 20,
        coordinates: true,
        includeOrigElements: false,
        chunkingStrategy: "by_title",
      },
    });

    if (response.statusCode === 200 && response.elements) {
      // Get the full document text for context
      const fullDocumentText = response.elements.map((e) => e.text).join("\n");

      const chunks = response.elements;
      const contextualizedChunks = (await Promise.all(
        chunks.map(async (chunk, index) => {
          const contexts = await generateChunkContextBatch(fullDocumentText, [
            chunk.text,
          ]);
          return {
            ...chunk,
            text: `${chunk.text.trim().replace(/\s+/g, " ")}\n\n${contexts[0]}`,
          };
        })
      )) as typeof chunks;

      const values = contextualizedChunks.map((chunk) => chunk.text);
      console.log("Embedding contextualized values:", values);

      // Process embeddings in batches of 100
      const batchSize = 100;
      let allEmbeddings = [];

      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const { embeddings: batchEmbeddings } = await embedMany({
          model: smallOpenaiEmbeddingModel,
          values: batch,
        });
        allEmbeddings.push(...batchEmbeddings);
      }

      // Validate that we have matching numbers of chunks and embeddings
      if (contextualizedChunks.length !== allEmbeddings.length) {
        throw new Error(
          `Mismatch between chunks (${contextualizedChunks.length}) and embeddings (${allEmbeddings.length})`
        );
      }

      // Only proceed with database insertion if we have chunks to process
      if (contextualizedChunks.length > 0) {
        await db.insert(documentEmbeddings).values(
          contextualizedChunks.map((element, i) => ({
            documentId: documentId,
            text: element.text,
            embedding: allEmbeddings[i],
            metadata: element.metadata,
          }))
        );
      }

      console.log("Successfully processed the file:", fileName);
    } else {
      console.error("Failed to process the file:", response);
    }
  } catch (error) {
    console.error(`Failed to process the file: ${error}`);
    throw new Error(`Failed to process the file: ${error}`);
  }
}

// Helper function to generate context for a chunk using GPT
async function generateChunkContextBatch(
  fullDocument: string,
  chunks: string[],
  batchSize = 5
): Promise<string[]> {
  const results: string[] = [];
  const encoder = getEncoder("gpt-4o-mini");

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const contexts = batch.map((chunk) =>
      getLocalContextTiktoken(
        fullDocument,
        chunk,
        "gpt-4o-mini",
        90_000,
        encoder
      )
    );

    const batchPromises = contexts.map(async (context, idx) => {
      try {
        const { text } = await generateText({
          model: MODELS["gpt-4o-mini"].model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `<document>\n${context}\n</document>` },
                {
                  type: "text",
                  text: `Here is the chunk we want to situate within the local context of the document:
<chunk>\n${batch[idx]}\n</chunk>

Please provide a short, succinct context to situate this chunk within the overall document for improving search retrieval. Answer only with the short context and nothing else.`,
                },
              ],
            },
          ],
        });
        return text;
      } catch (error) {
        console.error(
          `Failed to generate context for chunk ${i + idx}:`,
          error
        );
        return "";
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Returns local context around `chunk` (found in `fullText`) that stays under `maxTokens`.
 * Uses tiktoken to measure precise token count for a given model (default gpt-3.5-turbo).
 *
 * @param fullText - The entire text of the document.
 * @param chunk - The specific chunk we want to situate in context.
 * @param modelName - The tiktoken-compatible model name (e.g., "gpt-3.5-turbo").
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

  // Use binary search to find the optimal context window
  let start = index;
  let end = index + chunk.length;
  let bestSubstring = chunk;

  const expandContext = (currentSize: number): boolean => {
    const nextStart = Math.max(0, start - currentSize);
    const nextEnd = Math.min(fullText.length, end + currentSize);
    const candidate = fullText.slice(nextStart, nextEnd);
    const tokenCount = enc.encode(candidate).length;

    if (tokenCount <= maxTokens) {
      bestSubstring = candidate;
      start = nextStart;
      end = nextEnd;
      return true;
    }
    return false;
  };

  // Binary search for the largest context window that fits
  let low = 0;
  let high = Math.min(index, fullText.length - (index + chunk.length));

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (expandContext(mid)) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestSubstring;
}

/**
 * Returns a substring of `text` that fits within `maxTokens` for the given `modelName`.
 *
 * If `text` already fits, returns the entire text. Otherwise, returns a leading portion
 * that fits in `maxTokens`. (You could do more sophisticated middle trimming if desired.)
 */
function substringToMaxTokens(
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
