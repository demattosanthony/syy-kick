import {
  DocumentOCRStepConfig,
  FileData,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "../workflows.schemas";
import { CONFIG } from "../../../config/constants";
import { PDFDocument } from "pdf-lib";
import { mistralAi } from "../../models";

export const documentOcrStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as DocumentOCRStepConfig["config"];
  const chunkSize = 25; // Define chunk size

  if (debug) {
    console.log(`[${step.id}] Inputs:`, {
      documentDataSource: stepConfig.documentDataSource,
      chunkSize,
    });
  }

  const documentFileData = utils.getDataSourceValue(
    state,
    stepConfig.documentDataSource
  ) as FileData | undefined;

  // Validate input
  if (!documentFileData?.url || !documentFileData.fileName) {
    throw new Error(
      `Invalid document at '${stepConfig.documentDataSource}' in step ${step.id}`
    );
  }

  // Fetch PDF data
  let pdfBase64: string;
  try {
    const url = documentFileData.url;
    if (CONFIG.__prod__) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
    } else {
      // In dev, assume URL is already base64 data URI or raw base64
      if (url.startsWith("data:")) {
        pdfBase64 = url.split(",", 2)[1];
      } else {
        pdfBase64 = url;
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to get PDF data from '${stepConfig.documentDataSource}' in step ${
        step.id
      }: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Load the main PDF document
  const pdfDoc = await PDFDocument.load(pdfBase64);
  const totalPages = pdfDoc.getPageCount();

  if (debug) {
    console.log(`[${step.id}] Loaded PDF with ${totalPages} pages.`);
  }

  let combinedMarkdown = "";
  let combinedImages: FileData[] = [];

  // Process in chunks
  for (let startPage = 0; startPage < totalPages; startPage += chunkSize) {
    const endPage = Math.min(startPage + chunkSize, totalPages);
    const chunkPageCount = endPage - startPage;
    if (debug) {
      console.log(
        `[${step.id}] Processing chunk: pages ${startPage + 1} to ${endPage}`
      );
    }

    // Create a new PDF for the chunk
    const chunkPdfDoc = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: chunkPageCount },
      (_, i) => startPage + i
    );
    const copiedPages = await chunkPdfDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach((page) => chunkPdfDoc.addPage(page));

    // Save chunk to base64
    const chunkPdfBytes = await chunkPdfDoc.save();
    const chunkPdfBase64 = Buffer.from(chunkPdfBytes).toString("base64");
    const chunkDataUri = `data:application/pdf;base64,${chunkPdfBase64}`; // Create data URI

    // Run OCR on the chunk
    try {
      const result = await mistralAi.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          documentUrl: chunkDataUri, // Use data URI
          type: "document_url", // Use document_url type
        },
        includeImageBase64: true,
      });

      // Process results for the chunk
      for (const [pageIndexInChunk, item] of result.pages.entries()) {
        const absolutePageIndex = startPage + pageIndexInChunk; // Calculate absolute page index

        if (item.markdown) {
          combinedMarkdown += item.markdown + "\n\n";
        }

        for (
          let imageIndex = 0;
          imageIndex < item.images.length;
          imageIndex++
        ) {
          const image = item.images[imageIndex];
          if (!image.imageBase64) {
            continue;
          }

          // Extract base64 data, removing any prefix if present
          let imageBase64 = image.imageBase64;
          if (imageBase64.includes(",")) {
            imageBase64 = imageBase64.split(",", 2)[1];
          }

          // Use absolute page index in file name
          const fileName = `page_${absolutePageIndex}_image_${image.id}`;
          combinedImages.push({
            url: imageBase64,
            fileName: fileName,
            mimeType: "image/jpeg", // Assuming JPEG, adjust if needed
          });

          if (debug) {
            try {
              const imageFilePath = `./debug-images/${step.id}_${fileName}.jpeg`;
              await Bun.write(
                imageFilePath,
                Buffer.from(imageBase64, "base64")
              );
              console.log(
                `[${step.id}] Saved image from page ${
                  absolutePageIndex + 1
                }: ${imageFilePath}`
              );
            } catch (error) {
              console.error(
                `[${step.id}] Failed to save debug image ${fileName}:`,
                error
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `[${step.id}] OCR failed for chunk pages ${startPage + 1}-${endPage}:`,
        error
      );
      // Decide if we should continue with other chunks or throw
      // For now, let's log and continue, potentially returning partial results
      // Alternatively: throw new Error(`OCR failed for chunk pages ${startPage + 1}-${endPage}: ${error}`);
    }
  } // End chunk loop

  if (debug) {
    console.log(
      `[${step.id}] Finished processing all chunks. Total images extracted: ${combinedImages.length}`
    );
  }

  return {
    markdown: combinedMarkdown.trim(), // Trim trailing newlines
    images: combinedImages,
  };
};
