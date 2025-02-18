import { UnstructuredClient } from "unstructured-client";
import s3 from "./s3";
import { Strategy } from "unstructured-client/sdk/models/shared";
import { embeddingModel, googleEmbeddingModel } from "../features/models";
import db from "./db";
import { documentEmbeddings } from "./schema";
import { CONFIG } from "./constants";
import { embedMany } from "ai";

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
      return;
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
        maxCharacters: 300,
        combineUnderNChars: 50,
        overlap: 50,
        coordinates: true,
        includeOrigElements: false,
        chunkingStrategy: "by_title",
      },
    });

    if (response.statusCode === 200 && response.elements) {
      // Process the chunked elements as needed
      console.log("Chunked Elements:");

      const values = response.elements.map((element) =>
        element.text.trim().replace(/\s+/g, " ")
      );
      console.log("Embedding values:", values);

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

      await db.insert(documentEmbeddings).values(
        response.elements.map((element, i) => ({
          documentId: documentId,
          text: element.text,
          embedding: allEmbeddings[i],
          metadata: element.metadata,
        }))
      );

      console.log("Successfully processed the file:", fileName);
    } else {
      console.error("Failed to process the file:", response);
    }
  } catch (error) {
    console.error("Error processing the file:", error);
  }
}

export default unstructured;
