import { UnstructuredClient } from "unstructured-client";
import s3 from "./s3";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { googleEmbeddingModel, MODELS } from "../features/models";
import db from "./db";
import { documentEmbeddings, documents } from "./schema";
import { CONFIG } from "./constants";
import { embedMany, generateText } from "ai";
import { eq } from "drizzle-orm";

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
      maxElapsedTime: 900000, // 15min*60sec*1000ms = 15 minutes
    },
  },
});

const unstructuredApiSupportMimeTypes = [
  // Plaintext
  "text/plain", // .txt
  "message/rfc822", // .eml
  "application/vnd.ms-outlook", // .msg
  "application/xml", // .xml
  "text/html", // .html
  "text/markdown", // .md
  "text/x-rst", // .rst
  "application/json", // .json
  "application/rtf", // .rtf

  // Images
  "image/jpeg", // .jpeg
  "image/png", // .png

  // Documents
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/pdf", // .pdf
  "application/vnd.oasis.opendocument.text", // .odt
  "application/epub+zip", // .epub
  "text/csv", // .csv
  "text/tab-separated-values", // .tsv
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx

  // Zipped
  "application/gzip", // .gz
];

export async function processFile(
  fileKey: string,
  fileName: string,
  mimeType: string,
  documentId: string
) {
  try {
    if (!unstructuredApiSupportMimeTypes.includes(mimeType)) {
      console.log(`Skipping unsupported file type: ${mimeType}`);

      await db
        .update(documents)
        .set({ extractionStatus: "skipped" })
        .where(eq(documents.id, documentId));
      return;
    }

    // Read the file content
    const fileContent = await s3.file(fileKey).bytes();

    // Send the file to the Unstructured API for partitioning
    console.log("Processing file:", fileName);
    await db
      .update(documents)
      .set({ extractionStatus: "pending" })
      .where(eq(documents.id, documentId));
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
        combineUnderNChars: 75,
        overlap: 50,
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
      await db
        .update(documents)
        .set({ extractionStatus: "completed" })
        .where(eq(documents.id, documentId));
    } else {
      console.error("Failed to process the file:", response);
    }
  } catch (error) {
    console.error("Error processing the file:", error);
    await db
      .update(documents)
      .set({ extractionStatus: "failed" })
      .where(eq(documents.id, documentId));
  }
}

export default unstructured;

// Helper function to generate context for a chunk using Claude
async function generateChunkContext(
  fullDocument: string,
  chunk: string
): Promise<string> {
  const { text } = await generateText({
    model: MODELS["gpt-4o-mini"].model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<document>
${fullDocument}
</document>`,
            // providerOptions: {
            //   anthropic: { cacheControl: { type: "ephemeral" } },
            // },
          },
          {
            type: "text",
            text: `Here is the chunk we want to situate within the whole document
<chunk>
${chunk}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk.
Answer only with the succinct context and nothing else.`,
          },
        ],
      },
    ],
  });

  console.log("Contextual info:", text);

  return text;
}
