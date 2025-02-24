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

export async function processFile(
  fileKey: string,
  fileName: string,
  mimeType: string,
  documentId: string
) {
  try {
    // Determine extension (fallback to empty if no '.'):
    const extension = "." + (fileName.split(".").pop()?.toLowerCase() || "");
    console.log(`Processing file with extension: ${extension}`);

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

    // Add context to chunks
    const contextualizedChunks = await addContextToChunks(
      fullDocumentText,
      chunks
    );
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
  fullDocument: string,
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
          const localContext = getLocalContext(
            fullDocument,
            chunk.text,
            95_000
          );
          console.log(
            `Situated chunk in local context. Length: ${localContext.length}`
          );
          //   // Count the tokens
          //   const enc = encoding_for_model("gpt-4o-mini");
          //   const tokenCount = enc.encode(localContext).length;
          //   enc.free();
          //   console.log(`Token count: ${tokenCount}`);

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
 * Get the local context without precise token counting
 * Uses character-based approximation instead of token counting
 */
export function getLocalContext(
  fullText: string,
  chunk: string,
  maxTokens: number
): string {
  // Handle empty chunk case
  if (chunk === "") return "";

  const index = fullText.indexOf(chunk);
  if (index === -1) return chunk;

  // Simple character-to-token approximation
  const approxCharsPerToken = 4;
  const approxMaxChars = maxTokens * approxCharsPerToken;

  // Extract context with chunk in the middle
  const startPos = Math.max(0, index - approxMaxChars);
  const endPos = Math.min(
    fullText.length,
    index + chunk.length + approxMaxChars
  );

  // Get the context with the chunk in the middle
  return fullText.substring(startPos, endPos);
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
