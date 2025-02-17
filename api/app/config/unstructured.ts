import { UnstructuredClient } from "unstructured-client";
import s3 from "./s3";
import { Strategy } from "unstructured-client/sdk/models/shared";

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
  mimeType: string
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
        strategy: Strategy.Fast,
        splitPdfPage: true,
        splitPdfAllowFailed: true,
        splitPdfConcurrencyLevel: 15,
        maxCharacters: 1500,
        combineUnderNChars: 750,
        coordinates: true,
        includeOrigElements: false,
        chunkingStrategy: "by_title", // Chunk the document by title
      },
    });

    if (response.statusCode === 200 && response.elements) {
      // Process the chunked elements as needed
      console.log("Chunked Elements:", response.elements);
    } else {
      console.error("Failed to process the file:", response);
    }
  } catch (error) {
    console.error("Error processing the file:", error);
  }
}

export default unstructured;
