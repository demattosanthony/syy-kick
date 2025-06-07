import { getFileFromS3, uploadFileToS3 } from "./s3.ts";

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
      // Convert buffer to blob for file upload
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
    body: formData,
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

export async function convertPdfToImages(
  pdfData: Buffer,
  options?: { maxDimension?: number }
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
    // Validate input buffer
    if (!pdfData || !Buffer.isBuffer(pdfData) || pdfData.length === 0) {
      throw new Error(
        `Invalid PDF data: ${!pdfData ? "null/undefined" : !Buffer.isBuffer(pdfData) ? "not a Buffer" : "empty buffer (0 bytes)"}`
      );
    }

    const maxDimension = options?.maxDimension || 8000;
    const dpi = 300;

    console.log("Converting PDF to images using ConvertAPI with options:", {
      maxDimension,
      dpi,
      bufferSize: pdfData.length,
    });

    // Prepare parameters for ConvertAPI
    const parameters: Record<string, any> = {
      File: pdfData,
      ImageResolution: dpi,
      ImageMaxWidth: maxDimension,
      ImageMaxHeight: maxDimension,
    };

    // Call ConvertAPI to convert PDF to PNG
    const result = await callConvertApi("pdf", "png", parameters);

    if (!result.Files || result.Files.length === 0) {
      throw new Error("No files returned from ConvertAPI");
    }

    const images = [];

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
          path: file.Url || "",
          size: file.FileSize || base64Data.length,
          page: i + 1,
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

export async function convertPdfFromS3ToImages(
  fileKey: string,
  workflowId: string,
  workflowRunId: string,
  options: { maxDimension: number } = { maxDimension: 8000 }
): Promise<
  {
    type: "file";
    file: {
      fileKey: string;
      mimeType: string;
      fileName: string;
    };
  }[]
> {
  // Download PDF from S3
  const file = await getFileFromS3(fileKey);
  const pdfData = await file.Body?.transformToByteArray();

  if (!pdfData) {
    throw new Error("No data found");
  }

  // Convert PDF to images
  const images = await convertPdfToImages(Buffer.from(pdfData), options);

  // Upload images to S3
  const uploadPromises = images.map((image) => {
    const uploadFileKey = `workflows/${workflowId}/${workflowRunId}/${image.name}`;
    return uploadFileToS3(
      uploadFileKey,
      Buffer.from(image.base64, "base64"),
      "image/png"
    ).then(() => ({
      type: "file" as const,
      file: {
        fileKey: uploadFileKey,
        mimeType: "image/png",
        fileName: image.name,
      },
    }));
  });

  return Promise.all(uploadPromises);
}
