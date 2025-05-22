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
    // Make API request to convert PDF to images
    const response = await fetch(`${API_BASE_URL}/utils/pdf-to-images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileKey: fileKey,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const { imageKeys } = await response.json();

    // Return the API's image keys directly
    return imageKeys.map((imageKey: string) => {
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
  } catch (error) {
    console.error("Error converting PDF from S3 to images via API:", error);
    throw error;
  }
}
