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

// ConvertAPI configuration
const CONVERT_API_SECRET = process.env.CONVERT_API_SECRET || "";
const CONVERT_API_URL = "https://v2.convertapi.com";

interface ConvertApiResponse {
  ConversionCost: number;
  Files: Array<{
    FileName: string;
    FileSize: number;
    Url: string;
    FileData?: string; // Base64 encoded file data (alternative to Url)
  }>;
}

async function callConvertApi(
  fromFormat: string,
  toFormat: string,
  parameters: Record<string, any>
): Promise<ConvertApiResponse> {
  if (!CONVERT_API_SECRET) {
    throw new Error("CONVERT_API_SECRET environment variable is not set");
  }

  const url = `${CONVERT_API_URL}/convert/${fromFormat}/to/${toFormat}?Secret=${CONVERT_API_SECRET}`;

  console.log(`🔗 [ConvertAPI] Calling: ${fromFormat} → ${toFormat}`);
  console.log(
    `📋 [ConvertAPI] Parameters:`,
    Object.keys(parameters).map((key) =>
      key === "File"
        ? `${key}: [Buffer ${parameters[key]?.byteLength || parameters[key]?.length || 0} bytes]`
        : `${key}: ${parameters[key]}`
    )
  );

  // Create FormData for multipart upload
  const formData = new FormData();

  for (const [key, value] of Object.entries(parameters)) {
    if (key === "File") {
      // Convert base64 back to buffer for file upload
      let fileBuffer: Buffer;
      if (typeof value === "string") {
        fileBuffer = Buffer.from(value, "base64");
      } else if (Buffer.isBuffer(value)) {
        fileBuffer = value;
      } else {
        throw new Error("File parameter must be a base64 string or Buffer");
      }

      // Create a Blob from the buffer for FormData
      const blob = new Blob([fileBuffer], { type: "application/pdf" });
      formData.append("File", blob, "input.pdf");
    } else {
      // Add other parameters as regular form fields
      formData.append(key, String(value));
    }
  }

  console.log(
    `🔗 [ConvertAPI] Request URL: ${url.replace(CONVERT_API_SECRET, "[SECRET]")}`
  );

  const response = await fetch(url, {
    method: "POST",
    body: formData, // Use FormData instead of JSON
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ [ConvertAPI] Error response:`, errorText);
    throw new Error(
      `ConvertAPI error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();
  console.log(
    `✅ [ConvertAPI] Success: ${result.Files?.length || 0} files generated`
  );

  // Add debugging for the response structure
  console.log(
    `🔍 [ConvertAPI] Full response:`,
    JSON.stringify(result, null, 2)
  );

  return result;
}

export async function getPdfPageAsImage(
  pdfBytes: Uint8Array,
  pageNumber: number,
  options = { format: "png", dpi: 150, maxDimension: 2048 }
): Promise<string> {
  try {
    console.log("Converting PDF page to image using ConvertAPI:", pageNumber);

    // Convert Uint8Array to Buffer
    const pdfBuffer = Buffer.from(pdfBytes);

    // Call ConvertAPI to convert PDF to PNG
    const result = await callConvertApi("pdf", "png", {
      File: pdfBuffer, // Pass Buffer directly
      PageRange: `${pageNumber}-${pageNumber}`, // Convert only the specified page
      ImageResolution: options.dpi,
      ImageMaxWidth: options.maxDimension,
      ImageMaxHeight: options.maxDimension,
    });

    if (!result.Files || result.Files.length === 0) {
      throw new Error("No files returned from ConvertAPI");
    }

    // Download the converted image
    const imageUrl = result.Files[0].Url;
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download converted image: ${imageResponse.status}`
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(imageBuffer).toString("base64");
  } catch (error: any) {
    console.error("Error converting PDF page to image:", error);
    throw new Error(`Failed to convert PDF page to image: ${error.message}`);
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
  options: { maxDimension?: number } = { maxDimension: 2048 }
): Promise<
  {
    name: string;
    path: string;
    size: number;
    page: number;
    base64: string;
  }[]
> {
  try {
    console.log("Converting PDF to images using ConvertAPI");

    // Convert Uint8Array to Buffer
    const pdfBuffer = Buffer.from(pdfData);

    // Call ConvertAPI to convert PDF to PNG (all pages)
    const result = await callConvertApi("pdf", "png", {
      File: pdfBuffer, // Pass Buffer directly
      ImageResolution: 150,
      ImageMaxWidth: options.maxDimension || 2048,
      ImageMaxHeight: options.maxDimension || 2048,
    });

    if (!result.Files || result.Files.length === 0) {
      throw new Error("No files returned from ConvertAPI");
    }

    const images = [];

    for (let i = 0; i < result.Files.length; i++) {
      const file = result.Files[i];

      // Download the converted image
      const imageResponse = await fetch(file.Url);

      if (!imageResponse.ok) {
        console.error(
          `Failed to download image ${i + 1}: ${imageResponse.status}`
        );
        continue;
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString("base64");

      images.push({
        name: file.FileName,
        path: file.Url, // We could store the original URL or update this as needed
        size: file.FileSize,
        page: i + 1, // Page numbers start from 1
        base64: base64,
      });
    }

    return images;
  } catch (error: any) {
    console.error("Error converting PDF to images:", error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
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
  /** Raster DPI sent to ConvertAPI */
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

export async function convertPdfToImages(
  pdfData: Buffer,
  {
    maxDimension = 8000,
    dpi = 150,
    firstPageOnly = false,
  }: PdfToImagesOptions = {}
): Promise<PdfImageInfo[]> {
  try {
    // Validate input buffer
    if (!pdfData || !Buffer.isBuffer(pdfData) || pdfData.length === 0) {
      throw new Error(
        `Invalid PDF data: ${!pdfData ? "null/undefined" : !Buffer.isBuffer(pdfData) ? "not a Buffer" : "empty buffer (0 bytes)"}`
      );
    }

    console.log("Converting PDF to images using ConvertAPI with options:", {
      maxDimension,
      dpi,
      firstPageOnly,
      bufferSize: pdfData.length,
    });

    // Prepare parameters for ConvertAPI - pass Buffer directly
    const parameters: Record<string, any> = {
      File: pdfData, // Pass Buffer directly instead of base64
      ImageResolution: dpi,
      ImageMaxWidth: maxDimension,
      ImageMaxHeight: maxDimension,
    };

    // If only first page is requested, set page range
    if (firstPageOnly) {
      parameters.PageRange = "1-1";
    }

    // Call ConvertAPI to convert PDF to PNG
    const result = await callConvertApi("pdf", "png", parameters);

    if (!result.Files || result.Files.length === 0) {
      throw new Error("No files returned from ConvertAPI");
    }

    const images: PdfImageInfo[] = [];

    for (let i = 0; i < result.Files.length; i++) {
      const file = result.Files[i];

      console.log(
        `🖼️ [ConvertAPI] Processing file ${i + 1}: ${JSON.stringify(file)}`
      );

      try {
        let base64Data: string;

        // Check if the response contains base64 data directly or a URL
        if (file.FileData) {
          // ConvertAPI returned base64 data directly
          console.log(`📄 [ConvertAPI] Using direct base64 data from FileData`);
          base64Data = file.FileData;
        } else if (file.Url && file.Url.trim() !== "") {
          // ConvertAPI returned a URL to download from
          console.log(`⬇️ [ConvertAPI] Downloading image from: ${file.Url}`);
          const imageResponse = await fetch(file.Url);

          if (!imageResponse.ok) {
            console.error(
              `Failed to download image ${i + 1}: ${imageResponse.status}`
            );
            continue;
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          base64Data = Buffer.from(imageBuffer).toString("base64");
        } else {
          console.error(
            `❌ [ConvertAPI] File ${i + 1} has no URL or FileData:`,
            file
          );
          continue;
        }

        // Validate we have base64 data
        if (!base64Data || base64Data.trim() === "") {
          console.error(`❌ [ConvertAPI] File ${i + 1} has empty base64 data`);
          continue;
        }

        images.push({
          name: file.FileName || `page-${i + 1}.png`,
          path: file.Url || "", // May be empty if using direct base64
          size: file.FileSize || base64Data.length,
          page: i + 1, // Page numbers start from 1
          base64: base64Data,
        });

        console.log(`✅ [ConvertAPI] Successfully processed image ${i + 1}`);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        continue;
      }
    }

    // Check if we got any valid images
    if (images.length === 0) {
      throw new Error(
        "No valid images were processed from ConvertAPI response"
      );
    }

    // Return images sorted by page number
    return images.sort((a, b) => a.page - b.page);
  } catch (error: any) {
    console.error("Error converting PDF to images with ConvertAPI:", error);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}
