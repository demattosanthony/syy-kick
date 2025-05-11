import { Mistral } from "@mistralai/mistralai";
import type { OCRResponse } from "@mistralai/mistralai/models/components";
import { PDFDocument } from "pdf-lib";

const MAX_PAGES_PER_OCR_CHUNK = 15;
const MAX_SIZE_PER_OCR_CHUNK_MB = 50;
const MAX_SIZE_PER_OCR_CHUNK_BYTES = MAX_SIZE_PER_OCR_CHUNK_MB * 1024 * 1024;

interface MistralOcrInput {
  base64: string;
  mimeType: string;
  includeImages?: boolean;
}

export const mistral = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

/**
 * Helper function to clean base64 image data from OCR results.
 * Removes the "data:image/...;base64," prefix.
 */
function cleanOcrImageDataBase64(response: OCRResponse): void {
  if (response && response.pages) {
    response.pages.forEach((page) => {
      if (page.images) {
        page.images.forEach((image) => {
          if (image.imageBase64) {
            image.imageBase64 = image.imageBase64.replace(
              /^data:image\/\w+;base64,/,
              ""
            );
          }
        });
      }
    });
  }
}

/**
 * Process a pdf file with mistral ocr, handling chunking internally.
 * @param input - The input parameters for OCR processing
 */
export async function mistralOcr({
  base64,
  mimeType,
  includeImages = true,
}: MistralOcrInput): Promise<OCRResponse> {
  const allOcrPages: OCRResponse["pages"] = [];

  // Check if it's a PDF, otherwise process directly
  if (mimeType !== "application/pdf") {
    // For non-PDFs, process the whole file at once
    console.log(
      `Processing non-PDF file (${mimeType}) with Mistral OCR directly.`
    );
    try {
      const result = await mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          documentUrl: `data:${mimeType};base64,${base64}`,
          type: "document_url",
        },
        includeImageBase64: includeImages,
      });

      if (!result) {
        throw new Error("OCR processing returned no result for non-PDF");
      }
      cleanOcrImageDataBase64(result); // Clean image data
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Mistral OCR processing failed for non-PDF: ${errorMessage}`
      );
    }
  }

  // Handle PDF chunking
  console.log("Processing PDF with chunking inside mistralOcr.");
  let firstChunkResult: OCRResponse | null = null; // To store metadata from the first successful chunk

  try {
    const pdfDoc = await PDFDocument.load(base64);
    const totalPages = pdfDoc.getPageCount();
    console.log(`PDF has ${totalPages} pages. Chunking for Mistral OCR...`);

    // Process pages in chunks
    for (let i = 0; i < totalPages; i += MAX_PAGES_PER_OCR_CHUNK) {
      const startPage = i;
      const endPage = Math.min(i + MAX_PAGES_PER_OCR_CHUNK, totalPages);
      const numPagesInChunk = endPage - startPage;

      console.log(
        `Processing chunk: pages ${startPage + 1} to ${endPage} (${numPagesInChunk} pages)`
      );

      // Create a new PDF document for the chunk
      const chunkPdfDoc = await PDFDocument.create();
      const copiedPages = await chunkPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: numPagesInChunk }, (_, k) => startPage + k)
      );
      copiedPages.forEach((page) => chunkPdfDoc.addPage(page));

      const chunkPdfBytes = await chunkPdfDoc.save();

      // Check if chunk size exceeds limit
      if (chunkPdfBytes.byteLength > MAX_SIZE_PER_OCR_CHUNK_BYTES) {
        console.warn(
          `PDF chunk (pages ${startPage + 1}-${endPage}) exceeds size limit (${MAX_SIZE_PER_OCR_CHUNK_MB}MB). Size: ${(
            chunkPdfBytes.byteLength /
            1024 /
            1024
          ).toFixed(2)}MB. Attempting OCR anyway.`
        );
        // Or potentially throw an error:
        // throw new Error(`PDF chunk (pages ${startPage + 1}-${endPage}) exceeds size limit (${MAX_SIZE_PER_OCR_CHUNK_MB}MB)`);
      }

      const base64 = Buffer.from(chunkPdfBytes).toString("base64");

      console.log(
        `Calling Mistral OCR API for chunk (pages ${startPage + 1}-${endPage})...`
      );
      const result = await mistral.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          documentUrl: `data:${mimeType};base64,${base64}`,
          type: "document_url",
        },
        includeImageBase64: includeImages,
      });
      console.log(
        `Mistral OCR API finished for chunk (pages ${startPage + 1}-${endPage}). Found ${result.pages.length} pages in response.`
      );

      cleanOcrImageDataBase64(result); // Clean image data for the chunk

      // Store the result and potentially grab metadata from the first chunk
      if (allOcrPages.length === 0 && result.pages.length > 0) {
        // Keep track of the first successful chunk's result for metadata
        // This assumes OCRResponse has model and usageInfo
        firstChunkResult = result;
      }

      // Adjust page indices relative to the original document
      const adjustedPages = result.pages.map((page) => ({
        ...page,
        // startPage is 0-based, page.index is 1-based from the chunk
        index: startPage + page.index,
      }));

      allOcrPages.push(...adjustedPages);

      // Optional: Add delay between API calls if hitting rate limits
      if (endPage < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Consider making delay configurable
      }
    }

    // Construct the final OCRResponse object
    if (allOcrPages.length === 0) {
      // Handle case where no pages were extracted from any chunk
      console.warn("OCR processing yielded no pages after chunking.");
      // Return an empty but valid OCRResponse
      return {
        pages: [],
        model: firstChunkResult?.model || "mistral-ocr-latest", // Use first chunk model or default
        usageInfo: {
          pagesProcessed: 0,
          docSizeBytes: 0,
        },
      };
    }

    const combinedResponse: OCRResponse = {
      pages: allOcrPages,
      // Use model and usageInfo from the first chunk that returned pages
      model: firstChunkResult?.model || "mistral-ocr-latest", // Default if firstChunkResult is somehow null
      usageInfo: firstChunkResult?.usageInfo || {
        pagesProcessed: 0,
        docSizeBytes: 0,
      },
    };

    console.log(
      `Combined OCR results from ${allOcrPages.length} pages across all chunks.`
    );
    return combinedResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Mistral OCR processing failed during PDF chunking: ${errorMessage}`
    );
  }
}
