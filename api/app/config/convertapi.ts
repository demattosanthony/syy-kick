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

  return result;
}

export interface PdfToImagesOptions {
  /** Longest edge after optional resize. 0 or undefined ⇒ no resize */
  maxDimension?: number;
  /** Raster DPI sent to ConvertAPI */
  dpi?: number;
  /** When true, extract only page 1 */
  firstPageOnly?: boolean;
  /** Page range to convert (e.g., "1-2", "1-5,8") */
  pageRange?: string;
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
    dpi = 300,
    firstPageOnly = false,
    pageRange,
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
      pageRange,
      bufferSize: pdfData.length,
    });

    // Prepare parameters for ConvertAPI - pass Buffer directly
    const parameters: Record<string, any> = {
      File: pdfData, // Pass Buffer directly instead of base64
      ImageResolution: dpi,
      ImageWidth: maxDimension,
      ImageHeight: maxDimension,
    };

    // If only first page is requested, set page range
    if (firstPageOnly) {
      parameters.PageRange = "1-1";
    }

    // If page range is provided, set it
    if (pageRange) {
      parameters.PageRange = pageRange;
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
