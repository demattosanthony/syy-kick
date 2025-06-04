import { generateText } from "ai";
import { MODELS } from "./features/models";
import { ApiResponse } from "./config/schema";
import { Request, Response } from "express";
import { Workspace } from "./middleware";
import { promisify } from "util";
import { exec } from "child_process";
import path from "path";
import fs from "fs/promises";
import os from "os";

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

export async function pdfToImages(
  pdfData: Uint8Array,
  options: { maxDimension?: number } = { maxDimension: 4000 }
): Promise<
  {
    name: string;
    path: string;
    size: number;
    page: number;
    base64: string;
  }[]
> {
  const uniqueId = crypto.randomUUID();
  const tempPdfPath = `/tmp/pdf_${uniqueId}.pdf`;
  const outputPattern = `/tmp/output_${uniqueId}-%d.png`;

  try {
    // Write PDF data to temp file
    await Bun.write(tempPdfPath, pdfData);

    console.log("PDF written to temp file:", tempPdfPath);

    // Use Ghostscript to convert all PDF pages to PNG images
    const gsProc = Bun.spawn([
      "gs",
      "-dNOPAUSE",
      "-dBATCH",
      "-sDEVICE=png16m",
      "-r150",
      `-sOutputFile=${outputPattern}`,
      tempPdfPath,
    ]);

    const gsSuccess = await gsProc.exited;
    if (gsSuccess !== 0) {
      throw new Error(`Ghostscript process failed with exit code ${gsSuccess}`);
    }

    // Find all generated image files
    const tempDir = "/tmp";
    const files = await Array.fromAsync(
      new Bun.Glob(`output_${uniqueId}-*.png`).scan({
        cwd: tempDir,
      })
    );

    const images = [];

    for (const fileName of files) {
      const imagePath = `${tempDir}/${fileName}`;

      // Resize the image if maxDimension is provided
      if (options?.maxDimension && options.maxDimension > 0) {
        const resizedPath = `${tempDir}/resized_${fileName}`;

        const resizeProc = Bun.spawn([
          "convert",
          imagePath,
          "-resize",
          `${options.maxDimension}x${options.maxDimension}>`,
          resizedPath,
        ]);

        const resizeSuccess = await resizeProc.exited;
        if (resizeSuccess === 0) {
          // Replace original with resized version
          await Bun.spawn(["mv", resizedPath, imagePath]).exited;
        } else {
          console.error(`Failed to resize image ${fileName}, using original`);
        }
      }

      // Extract page number from filename
      const pageMatch = fileName.match(/output_[^-]+-(\d+)\.png/);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 0;

      // Read image file
      const imageFile = Bun.file(imagePath);
      const imageBuffer = await imageFile.arrayBuffer();
      const stats = await imageFile.stat();

      images.push({
        name: fileName,
        path: imagePath,
        size: stats.size,
        page: pageNum,
        base64: Buffer.from(imageBuffer).toString("base64"),
      });
    }

    return images;
  } catch (error: any) {
    console.error("Error:", error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      const tempDir = "/tmp";
      const allTempFiles = await Array.fromAsync(
        new Bun.Glob(
          `{pdf_${uniqueId}.pdf,output_${uniqueId}-*.png,resized_output_${uniqueId}-*.png}`
        ).scan({
          cwd: tempDir,
        })
      );

      await Promise.all(
        allTempFiles.map(
          (file) => Bun.spawn(["rm", "-f", `${tempDir}/${file}`]).exited
        )
      );

      // Also clean up the original temp PDF
      await Bun.spawn(["rm", "-f", tempPdfPath]).exited;
    } catch (error) {
      console.error("Error cleaning up temporary files:", error);
    }
  }
}

export async function getFileHash(fileBuffer: Buffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // Convert bytes to hex string
  return hashHex;
}

export interface PdfToImagesOptions {
  /** Longest edge after optional resize. 0 or undefined ⇒ no resize */
  maxDimension?: number;
  /** Raster DPI sent to Ghostscript */
  dpi?: number;
  /** When true, extract only page 1 */
  firstPageOnly?: boolean;
}

export interface PdfImageInfo {
  name: string;
  path: string;
  size: number;
  page: number;
  base64: string;
}

/**
 * Rasterise a PDF into PNGs.
 * – Set `firstPageOnly:true` to get just the first page.
 * – Images are returned in page order, each already Base-64 encoded.
 */
export async function convertPdfToImages(
  pdfData: Buffer,
  {
    maxDimension = 8000,
    dpi = 300,
    firstPageOnly = false,
  }: PdfToImagesOptions = {}
): Promise<PdfImageInfo[]> {
  const execAsync = promisify(exec);
  const uniqueId = crypto.randomUUID();
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `pdf-images-${uniqueId}`)
  );
  const tempPdf = path.join(tempDir, "input.pdf");
  const outputPattern = path.join(tempDir, "output-%d.png");

  try {
    await fs.writeFile(tempPdf, pdfData);

    // Limit pages when requested
    const pageArgs = firstPageOnly ? "-dFirstPage=1 -dLastPage=1" : "";

    const gsCmd = `gs -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r${dpi} \
${pageArgs} -sOutputFile="${outputPattern}" "${tempPdf}"`;
    await execAsync(gsCmd);
    console.log("Finished converting PDF to images");

    const files = await fs.readdir(tempDir);
    const images: PdfImageInfo[] = [];

    for (const file of files) {
      if (!file.startsWith("output-") || !file.endsWith(".png")) continue;
      console.log("Processing file:", file);

      const imgPath = path.join(tempDir, file);

      // Optional resize
      if (maxDimension && maxDimension > 0) {
        try {
          await execAsync(
            `convert "${imgPath}" -resize "${maxDimension}x${maxDimension}>" "${imgPath}"`
          );
        } catch (err) {
          console.error(`Resize failed for ${file}:`, err);
        }
      }

      const pageMatch = file.match(/output-(\d+)\.png/);
      const pageNum = pageMatch ? Number(pageMatch[1]) : 0;

      const buf = await fs.readFile(imgPath);
      const { size } = await fs.stat(imgPath);

      images.push({
        name: file,
        path: imgPath,
        size,
        page: pageNum,
        base64: buf.toString("base64"),
      });
    }

    // ensure natural order
    images.sort((a, b) => a.page - b.page);
    return images;
  } finally {
    // clean-up no matter what
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
