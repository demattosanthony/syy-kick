import { UnstructuredClient } from "unstructured-client";
import s3 from "./s3";
import { Strategy } from "unstructured-client/sdk/models/shared";

const unstructured = new UnstructuredClient({
  serverURL: process.env.UNSTRUCTURED_API_URL,
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY,
  },
});

export async function processFile(fileKey: string, fileName: string) {
  try {
    // Read the file content
    const fileContent = await s3.file(fileKey).bytes();

    // Send the file to the Unstructured API for partitioning
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
