import { UnstructuredClient } from "unstructured-client";
import s3 from "./s3";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { googleEmbeddingModel, MODELS } from "../features/models";
import db from "./db";
import { documentEmbeddings } from "./schema";
import { CONFIG } from "./constants";
import { embedMany, generateText } from "ai";
import { encoding_for_model, TiktokenModel } from "tiktoken";

const unstructured = new UnstructuredClient({
  serverURL: process.env.UNSTRUCTURED_API_URL,
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY,
  },
  // 2 hours in milliseconds
  timeoutMs: 7200000,
  retryConfig: {
    strategy: "backoff",
    retryConnectionErrors: true,
    backoff: {
      initialInterval: 500,
      maxInterval: 60000,
      exponent: 1.5,
      maxElapsedTime: 1800000, // 30min*60sec*1000ms = 30 minutes
    },
  },
});

// Define supported extensions:
const unstructuredApiSupportExtensions = [
  ".abw",
  ".bmp",
  ".csv",
  ".cwk",
  ".dbf",
  ".dif",
  ".doc",
  ".docm",
  ".docx",
  ".dot",
  ".dotm",
  ".eml",
  ".epub",
  ".et",
  ".eth",
  ".fods",
  ".gif",
  ".heic",
  ".htm",
  ".html",
  ".hwp",
  ".jpeg",
  ".jpg",
  ".md",
  ".mcw",
  ".mw",
  ".odt",
  ".org",
  ".p7s",
  ".pages",
  ".pbd",
  ".pdf",
  ".png",
  ".pot",
  ".potm",
  ".ppt",
  ".pptm",
  ".pptx",
  ".prn",
  ".rst",
  ".rtf",
  ".sdp",
  ".sgl",
  ".svg",
  ".sxg",
  ".tiff",
  ".txt",
  ".tsv",
  ".uof",
  ".uos1",
  ".uos2",
  ".web",
  ".webp",
  ".wk2",
  ".xls",
  ".xlsb",
  ".xlsm",
  ".xlsx",
  ".xlw",
  ".xml",
  ".zabw",
];

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
        strategy: CONFIG.__prod__ ? Strategy.Auto : Strategy.Fast,
        splitPdfPage: true,
        splitPdfAllowFailed: true,
        splitPdfConcurrencyLevel: 15,
        maxCharacters: 400,
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

      const contextualizedChunks = await Promise.all(
        response.elements.map(async (element) => {
          // Get context for the chunk
          const context = await generateChunkContext(
            fullDocumentText,
            element.text
          );

          // Combine context with original text
          return {
            ...element,
            text: `${element.text.trim().replace(/\s+/g, " ")}\n\n${context}`,
          } as typeof element;
        })
      );

      const values = contextualizedChunks.map((chunk) => chunk.text);
      console.log("Embedding contextualized values:", values);

      // Process embeddings in batches of 100
      const batchSize = 100;
      let allEmbeddings = [];

      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const { embeddings: batchEmbeddings } = await embedMany({
          model: googleEmbeddingModel,
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
async function generateChunkContext(
  fullDocument: string,
  chunk: string
): Promise<string> {
  try {
    // Extract local context around the chunk
    const localContext = getLocalContextTiktoken(
      fullDocument,
      chunk,
      "gpt-4o-mini",
      90_000
    );

    // Now, pass only the local context to the model
    const { text } = await generateText({
      model: MODELS["gpt-4o-mini"].model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `<document>
${localContext}
</document>`,
            },
            {
              type: "text",
              text: `Here is the chunk we want to situate within the local context of the document:
<chunk>
${chunk}
</chunk>

Please provide a short, succinct context to situate this chunk within the overall document for improving search retrieval. Answer only with the short context and nothing else.`,
            },
          ],
        },
      ],
    });

    console.log("Contextual info:", text);

    return text;
  } catch (error) {
    console.error("Failed to generate chunk context:", error);
    throw new Error(`Failed to generate chunk context: ${error}`);
  }
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
  maxTokens = 128_000
): string {
  // Locate the chunk within the text
  const index = fullText.indexOf(chunk);
  if (index === -1) {
    // If `chunk` isn't found, return a substring of the whole document if it fits
    // or just enough to fit `maxTokens`.
    return substringToMaxTokens(fullText, modelName, maxTokens);
  }

  // If the chunk alone is larger than maxTokens, just return chunk truncated
  const enc = encoding_for_model(modelName);
  const chunkTokens = enc.encode(chunk).length;
  enc.free();
  if (chunkTokens >= maxTokens) {
    // Return partial chunk if it still exceeds the max token limit
    const fractionOfChunk = substringToMaxTokens(chunk, modelName, maxTokens);
    return fractionOfChunk;
  }

  // Otherwise build a substring with chunk in the center, and expand equally
  // until we exceed `maxTokens` or reach text boundaries.
  // We'll do a simple doubling approach from the chunk’s immediate region.
  let start = index;
  let end = index + chunk.length;

  // Step 1: start with the chunk itself
  let bestSubstring = chunk;
  let bestTokenCount = chunkTokens;

  // Step 2: Expand outward in both directions while under the limit
  const textLen = fullText.length;
  while (true) {
    // Attempt to expand out by some step. Start small, go big.
    // For simplicity, expand by e.g. 2,048 characters each iteration (1,024 on each side)
    // You can adjust the chunkGrowSize to fit your preference.
    const chunkGrowSize = 2048;

    // Next potential start/end
    const nextStart = Math.max(0, start - chunkGrowSize);
    const nextEnd = Math.min(textLen, end + chunkGrowSize);

    // If we cannot expand further, break
    if (nextStart === start && nextEnd === end) {
      break;
    }

    // Candidate substring
    const candidate = fullText.slice(nextStart, nextEnd);
    const candidateEnc = encoding_for_model(modelName);
    const candidateTokens = candidateEnc.encode(candidate).length;
    candidateEnc.free();

    // If it fits, accept it, else break
    if (candidateTokens <= maxTokens) {
      bestSubstring = candidate;
      bestTokenCount = candidateTokens;
      start = nextStart;
      end = nextEnd;
    } else {
      // Reached or exceeded the token limit
      break;
    }
  }

  // Return the largest substring we found that fits
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
  maxTokens: number
): string {
  const enc = encoding_for_model(modelName);
  const tokens = enc.encode(text);
  if (tokens.length <= maxTokens) {
    // Fits as-is
    enc.free();
    return text;
  }
  // Otherwise, decode only the portion of tokens that fits
  const fittingTokens = tokens.slice(0, maxTokens);
  const partialByteArray = enc.decode(fittingTokens);
  const partialText = new TextDecoder().decode(partialByteArray);
  enc.free();
  return partialText;
}

export default unstructured;
