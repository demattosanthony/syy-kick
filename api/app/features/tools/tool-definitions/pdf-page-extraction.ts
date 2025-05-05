import { tool, Tool } from "ai";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { ArtifactService } from "../../workflows/artifact-service";
import { getPdfPageAsImage } from "../../../utils";

export function createPdfPageExtractionTool(
  toolArtifactService: ArtifactService
): Tool {
  return tool({
    description:
      "Extracts pages from a PDF file and converts them to images. This tool automatically saves the images as artifacts.",
    parameters: z.object({
      fileName: z
        .string()
        .describe("The name of the PDF file to extract pages from."),
      pageNumbers: z.array(z.number()).describe("The page numbers to extract."),
    }),
    execute: async ({ fileName, pageNumbers }) => {
      try {
        const pdfBytes = (await toolArtifactService.loadArtifact(fileName))
          ?.data;
        if (!pdfBytes) {
          return {
            success: false,
            message: `PDF file '${fileName}' not found.`,
          };
        }

        const pdfDoc = await PDFDocument.load(pdfBytes);

        for (const pageNumber of pageNumbers) {
          const newPdfDoc = await PDFDocument.create();
          const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [
            pageNumber - 1,
          ]);
          newPdfDoc.addPage(copiedPage);
          const newPdfBytes = await newPdfDoc.save();
          const pageImageBase64 = await getPdfPageAsImage(newPdfBytes, 1, {
            format: "png",
            dpi: 96,
            maxDimension: 8000,
          });

          await toolArtifactService.saveArtifact(
            `${fileName}-page-${pageNumber}.png`,
            {
              data: Buffer.from(pageImageBase64, "base64"),
              mimeType: "image/png",
            }
          );
        }

        return {
          success: true,
          message: `Successfully extracted ${pageNumbers.length} pages from '${fileName}' and saved them as artifacts.`,
        };
      } catch (error) {
        console.error(
          `[PdfPageExtractionTool] Error processing ${fileName}:`,
          error
        );
        return {
          success: false,
          message: `Failed to extract pages from '${fileName}': ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  });
}
