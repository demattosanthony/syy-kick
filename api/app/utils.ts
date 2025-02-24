import { generateText } from "ai";
import { MODELS } from "./features/models";
import { ApiResponse } from "./config/schema";
import { Request, Response } from "express";
import s3 from "./config/s3";

export async function generateThreadTitle(message: string) {
  const { text } = await generateText({
    model: MODELS["gemini-2.0-flash"].model,
    temperature: 0.6,
    prompt: `Generate a title for the following user message. The title should describe what their message is about so they can later find it easily. THe title should be 3 words give or take. Only respond with the title and nothing else.\n\nUser message:\n\n${message}`,
  });

  return text;
}

export const handle =
  <T>(fn: (req: Request) => Promise<T>) =>
  async (req: Request, res: Response) => {
    try {
      const data = await fn(req);
      res.json(data as ApiResponse<T>);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      } as ApiResponse<T>);
    }
  };

export async function getPdfPageAsImage(
  pdfBytes: Uint8Array,
  pageNumber: number,
  options = { format: "png", dpi: 96 }
): Promise<string> {
  // Remove the unnecessary tempDir read
  const uniqueId = crypto.randomUUID();
  const tempPdfPath = `/tmp/pdf_${uniqueId}.pdf`;
  const tempPngPath = `/tmp/png_${uniqueId}.png`;

  try {
    // Get PDF from S3 and save to temp file
    await Bun.write(tempPdfPath, pdfBytes);

    console.log("PDF downloaded to temp file:", tempPdfPath);

    // Use Ghostscript to convert PDF page to PNG
    const proc = Bun.spawn([
      "gs",
      "-dQUIET",
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=png16m",
      `-dFirstPage=${pageNumber}`,
      `-dLastPage=${pageNumber}`,
      `-r${options.dpi}`,
      `-sOutputFile=${tempPngPath}`,
      tempPdfPath,
    ]);

    // Wait for the process to complete
    const success = await proc.exited;
    if (success !== 0) {
      throw new Error(`Ghostscript process failed with exit code ${success}`);
    }

    // Read the generated PNG and upload to S3
    const imageBuffer = await Bun.file(tempPngPath).arrayBuffer();

    return Buffer.from(imageBuffer).toString("base64");
  } catch (error: any) {
    console.error("Error:", error);
    throw new Error(`Failed to convert PDF page to image: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      await Promise.all([
        Bun.spawn(["rm", "-f", tempPdfPath]).exited,
        Bun.spawn(["rm", "-f", tempPngPath]).exited,
      ]);
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }
  }
}
