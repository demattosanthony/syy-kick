// Configure API base URL from environment or default to localhost
const API_BASE_URL = process.env.SYYKICK_API || "http://localhost:4000";

export async function convertPdfFromS3ToImages(
  fileKey: string,
  workflowId: string,
  workflowRunId: string
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
  try {
    // Make API request to convert PDF to images with a longer timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("Request timeout reached, aborting...");
      controller.abort();
    }, 600000); // 10 minute timeout (increased from 5 minutes)

    console.log("making api request to convert pdf to images");
    console.log("fileKey", fileKey);
    console.log("API_BASE_URL", API_BASE_URL);

    const startTime = Date.now();

    const response = await fetch(`${API_BASE_URL}/utils/pdf-to-images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileKey: fileKey,
      }),
      signal: controller.signal,
    });

    const fetchTime = Date.now() - startTime;
    console.log(`Fetch completed in ${fetchTime}ms`);

    clearTimeout(timeoutId);

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error response:", errorText);
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log("Starting to parse response JSON...");
    const responseData = await response.json();
    console.log("Response data parsed successfully");

    const { imageKeys } = responseData;
    console.log("imageKeys received:", imageKeys);

    if (!imageKeys || !Array.isArray(imageKeys)) {
      throw new Error("Invalid response: imageKeys is not an array");
    }

    // Return the API's image keys directly
    const result = imageKeys.map((imageKey: string) => {
      const fileName = imageKey.split("/").pop() || "image.png";
      return {
        type: "file" as const,
        file: {
          fileKey: imageKey,
          mimeType: "image/png",
          fileName: fileName,
        },
      };
    });

    console.log(`Successfully converted PDF to ${result.length} images`);
    return result;
  } catch (error) {
    console.error("Error converting PDF from S3 to images via API:", error);

    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      if (error.name === "AbortError") {
        console.error("Request was aborted due to timeout");
      }
    }

    throw error;
  }
}
