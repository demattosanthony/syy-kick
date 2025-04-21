import { generateText } from "ai";
import { MODELS } from "./features/models";
import { ApiResponse } from "./config/schema";
import { Request, Response } from "express";
import { Workspace } from "./middleware";

export function getOrgIdOrUnedfined(workspace?: Workspace) {
  return workspace?.type === "organization" ? workspace.id : undefined;
}

export async function generateThreadTitle(message: string) {
  const { text } = await generateText({
    model: MODELS["gpt-4.1-mini"].model,
    temperature: 0.65,
    prompt: `Generate a title for the following user message. The title should describe what their message is about so they can later find it easily. The title should be 3 to 4 words give or take. Only respond with the title and nothing else.\n\nUser message:\n\n${message}`,
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
  options = { format: "png", dpi: 96, maxDimension: 2000 }
): Promise<string> {
  // Remove the unnecessary tempDir read
  const uniqueId = crypto.randomUUID();
  const tempPdfPath = `/tmp/pdf_${uniqueId}.pdf`;
  const tempPngPath = `/tmp/png_${uniqueId}.png`;
  const tempResizedPath = `/tmp/png_resized_${uniqueId}.png`;

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

    // Resize the image if needed using ImageMagick
    const resizeProc = Bun.spawn([
      "convert",
      tempPngPath,
      "-resize",
      `${options.maxDimension}x${options.maxDimension}>`, // Only shrink if larger
      tempResizedPath,
    ]);

    const resizeSuccess = await resizeProc.exited;
    if (resizeSuccess !== 0) {
      throw new Error(
        `ImageMagick resize process failed with exit code ${resizeSuccess}`
      );
    }

    // Read the resized PNG
    const imageBuffer = await Bun.file(tempResizedPath).arrayBuffer();

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
        Bun.spawn(["rm", "-f", tempResizedPath]).exited,
      ]);
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }
  }
}

export const slugify = (text: string) => {
  return text
    .toString() // Cast to string
    .toLowerCase() // Convert the string to lowercase letters
    .normalize("NFD") // The normalize() method returns the Unicode Normalization Form of a given string.
    .trim() // Remove whitespace from both sides of a string
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
};