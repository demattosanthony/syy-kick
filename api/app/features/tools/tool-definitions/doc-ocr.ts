import { tool, Tool } from "ai";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import { ArtifactService } from "../../workflows/artifact-service";
import { mistralAi } from "../../models";

export function createDocOcrTool(toolArtifactService: ArtifactService): Tool {
  return tool({
    description:
      "Run Optical Character Recognition (OCR) on a PDF or image file and extract markdown content. The extract markdown will be saved as an artifact.",
    parameters: z.object({
      fileName: z
        .string()
        .describe(
          "The filename of the PDF or image file (e.g., document.pdf, image.png) to run OCR on."
        ),
    }),
    execute: async ({ fileName }) => {
      const artifact = await toolArtifactService.loadArtifact(fileName);
      if (!artifact?.data) {
        return {
          success: false,
          message: `Artifact '${fileName}' not found.`,
        };
      }

      const fileData = artifact.data; // Assuming data is Buffer or Uint8Array
      const fileType = fileName.split(".").pop()?.toLowerCase();

      let combinedMarkdown = "";
      const chunkSize = 25; // Define chunk size for PDFs

      try {
        if (fileType === "pdf") {
          // Load the main PDF document
          const pdfDoc = await PDFDocument.load(fileData);
          const totalPages = pdfDoc.getPageCount();

          // Process in chunks
          for (
            let startPage = 0;
            startPage < totalPages;
            startPage += chunkSize
          ) {
            const endPage = Math.min(startPage + chunkSize, totalPages);
            const chunkPageCount = endPage - startPage;

            // Create a new PDF for the chunk
            const chunkPdfDoc = await PDFDocument.create();
            const pageIndices = Array.from(
              { length: chunkPageCount },
              (_, i) => startPage + i
            );
            const copiedPages = await chunkPdfDoc.copyPages(
              pdfDoc,
              pageIndices
            );
            copiedPages.forEach((page) => chunkPdfDoc.addPage(page));

            // Save chunk to base64 data URI
            const chunkPdfBytes = await chunkPdfDoc.save();
            const chunkPdfBase64 =
              Buffer.from(chunkPdfBytes).toString("base64");
            const chunkDataUri = `data:application/pdf;base64,${chunkPdfBase64}`;

            // Run OCR on the chunk
            const result = await mistralAi.ocr.process({
              model: "mistral-ocr-latest",
              document: {
                documentUrl: chunkDataUri,
                type: "document_url",
              },
              includeImageBase64: false, // Don't need images for this tool
            });

            // Process results for the chunk
            result.pages.forEach((item) => {
              if (item.markdown) {
                combinedMarkdown += item.markdown + "\n\n";
              }
            });
          }
        } else if (["png", "jpg", "jpeg", "webp"].includes(fileType || "")) {
          // Handle images
          const imageBase64 = Buffer.from(fileData).toString("base64");
          // Determine mime type based on extension
          let mimeType = "image/jpeg"; // Default
          if (fileType === "png") mimeType = "image/png";
          if (fileType === "webp") mimeType = "image/webp";
          const imageDataUri = `data:${mimeType};base64,${imageBase64}`;

          const result = await mistralAi.ocr.process({
            model: "mistral-ocr-latest",
            document: {
              imageUrl: imageDataUri,
              type: "image_url",
            },
            includeImageBase64: false,
          });

          result.pages.forEach((item) => {
            if (item.markdown) {
              combinedMarkdown += item.markdown + "\n\n";
            }
          });
        } else {
          return {
            success: false,
            message: `Unsupported file type for OCR: '${fileType}'. Only PDF, PNG, JPG, JPEG, WEBP are supported.`,
          };
        }

        toolArtifactService.saveArtifact(`${fileName}-ocr.md`, {
          data: Buffer.from(combinedMarkdown),
          mimeType: "text/markdown",
        });

        return {
          success: true,
          //   markdown: combinedMarkdown.trim(),
          message: `Successfully ran OCR on '${fileName}'.`,
        };
      } catch (error: any) {
        console.error(`[DocOcrTool] Error processing ${fileName}:`, error);
        return {
          success: false,
          message: `Failed to run OCR on '${fileName}': ${
            error.message || "Unknown error"
          }`,
        };
      }
    },
  });
}
