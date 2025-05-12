import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

export async function convertPdfToImages(pdfData: Buffer): Promise<
  {
    name: string;
    path: string;
    size: number;
    page: number;
    base64: string;
  }[]
> {
  const execAsync = promisify(exec);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-images-"));
  const tempPdfPath = path.join(tempDir, "input.pdf");
  const outputPattern = path.join(tempDir, "output-%d.png");

  try {
    await fs.writeFile(tempPdfPath, Buffer.from(pdfData));

    const gsCommand = `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${outputPattern}" "${tempPdfPath}"`;

    await execAsync(gsCommand);

    const imageFiles = await fs.readdir(tempDir);
    const images = [];

    for (const imageFile of imageFiles) {
      if (imageFile.startsWith("output-") && imageFile.endsWith(".png")) {
        const imagePath = path.join(tempDir, imageFile);
        const pageMatch = imageFile.match(/output-(\d+)\.png/);
        const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 0;

        const imageBuffer = await fs.readFile(imagePath);
        const stats = await fs.stat(imagePath);

        images.push({
          name: imageFile,
          path: imagePath,
          size: stats.size,
          page: pageNum,
          base64: imageBuffer.toString("base64"),
        });
      }
    }

    await fs.rm(tempDir, { recursive: true, force: true });

    return images;
  } catch (error) {
    console.error(error);
    // Delete the temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
