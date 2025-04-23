import { PDFDocument } from "pdf-lib";
import { getPdfPageAsImage } from "../../../utils";
import {
  FileData,
  PdfPageExtractStepConfig,
  StepExecutorFunction,
  StepExecutorInput,
  StepOutputData,
} from "../workflows.schemas";

export const executePdfPageExtractionStep: StepExecutorFunction = async ({
  step,
  state,
  utils,
  debug,
}: StepExecutorInput): Promise<StepOutputData> => {
  const stepConfig = step.config as PdfPageExtractStepConfig["config"];
  if (debug) {
    console.log(`[${step.id}] Inputs:`, {
      pdfDataSource: stepConfig.pdfDataSource,
      pageNumberSource: stepConfig.pageNumbersSource,
    });
  }
  const pageNumbers = utils.getDataSourceValue(
    state,
    stepConfig.pageNumbersSource
  ) as number[];
  const pdfFileInfo = utils.getDataSourceValue(
    state,
    stepConfig.pdfDataSource
  ) as FileData;

  // Validate inputs
  if (!pdfFileInfo?.url || !pdfFileInfo.fileName) {
    throw new Error(
      `Invalid PDF data source '${stepConfig.pdfDataSource}' in step ${step.id}`
    );
  }
  if (
    !Array.isArray(pageNumbers) ||
    pageNumbers.length === 0 ||
    pageNumbers.some(
      (n) => typeof n !== "number" || !Number.isInteger(n) || n <= 0
    )
  ) {
    throw new Error(
      `Invalid page numbers provided by '${stepConfig.pageNumbersSource}' in step ${step.id}. Expected a non-empty array of positive integers.`
    );
  }

  // In prod, the PDF is a presigned URL, so we need to fetch it
  // Otherwise, it might be a base64 string (adjust based on actual non-prod setup)
  let pdfBytes: Buffer;
  try {
    const url = pdfFileInfo.url;
    // Assuming URL means fetch is needed (prod or dev with URL)
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (debug) console.log(`[${step.id}] Fetching PDF from URL: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF from URL: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBytes = Buffer.from(arrayBuffer);
    } else {
      // Assuming it's base64 data if not a URL
      if (debug) console.log(`[${step.id}] Decoding base64 PDF data.`);
      pdfBytes = Buffer.from(url, "base64");
    }
  } catch (error) {
    throw new Error(
      `Failed to load PDF data from '${stepConfig.pdfDataSource}' in step ${step.id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // Load PDF document
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  // Validate all requested page numbers against the actual PDF page count
  for (const pageNumber of pageNumbers) {
    if (pageNumber > totalPages) {
      throw new Error(
        `Requested page number ${pageNumber} exceeds PDF page count (${totalPages}) in step ${step.id}`
      );
    }
  }

  if (debug) {
    console.log(
      `[${step.id}] Extracting pages ${pageNumbers.join(
        ", "
      )} from PDF with ${totalPages} total pages.`
    );
  }

  const extractedImagesBase64: string[] = [];

  // Process each requested page number
  for (const pageNumber of pageNumbers) {
    if (debug) {
      console.log(`[${step.id}] Processing page ${pageNumber}...`);
    }

    try {
      // Create a new PDF document containing only the target page
      const newPdfDoc = await PDFDocument.create();
      // pdf-lib uses 0-based indexing for pages
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
      newPdfDoc.addPage(copiedPage);

      // Save the single-page PDF to bytes
      const newPdfBytes = await newPdfDoc.save();

      // Convert the single-page PDF to an image
      // getPdfPageAsImage expects the page number within *its* input (which is 1)
      const pageImageBase64 = await getPdfPageAsImage(newPdfBytes, 1, {
        format: "png", // Or make configurable if needed
        dpi: stepConfig.scale ? 150 * stepConfig.scale : 150, // Example: Allow scaling DPI
        maxDimension: 8000, // Consider if this needs adjustment
      });

      extractedImagesBase64.push(pageImageBase64);

      // Save debug image if enabled
      if (debug) {
        try {
          const imageFilePath = `./debug-images/${step.id}_page_${pageNumber}.png`;
          await Bun.write(
            imageFilePath,
            Buffer.from(pageImageBase64, "base64")
          );
          console.log(
            `[${step.id}] Saved image for page ${pageNumber} to ${imageFilePath}`
          );
        } catch (writeError) {
          console.error(
            `[${step.id}] Failed to save debug image for page ${pageNumber}:`,
            writeError
          );
        }
      }
    } catch (pageError) {
      console.error(
        `[${step.id}] Failed to extract or convert page ${pageNumber}:`,
        pageError
      );
      // Rethrow the error to fail the step if a page cannot be processed
      throw new Error(
        `Failed to process page ${pageNumber} in step ${step.id}: ${
          pageError instanceof Error ? pageError.message : String(pageError)
        }`
      );
    }
  } // End loop through pageNumbers

  if (debug) {
    console.log(
      `[${step.id}] Successfully extracted ${extractedImagesBase64.length} pages as images.`
    );
  }

  // Return the array of extracted page images as base64 strings.
  // Note: The output key 'extractedImagesBase64' should be used by subsequent steps.
  return { extractedImagesBase64 };
};
