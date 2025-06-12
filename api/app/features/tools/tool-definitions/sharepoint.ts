import { tool } from "ai";
import { z } from "zod";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { MicrosoftAPI } from "../../../config/microsoft";
import { processAndStoreFile } from "../../files/files.ops";

interface GraphDriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  file?: { mimeType: string; hashes?: any };
  webUrl: string;
  parentReference?: {
    driveId: string;
    path?: string;
  };
  lastModifiedDateTime?: string;
  "@microsoft.graph.downloadUrl"?: string;
  size?: number;
}

// Helper function to get drive ID and graph client
const getDriveIdAndClient = async (userId: string) => {
  const microsoftGraph = new MicrosoftAPI({ userId });
  const accessToken = await microsoftGraph.getAccessToken("graph");

  if (!accessToken) {
    throw new Error("No Microsoft Graph access token available");
  }

  const graphClient = await microsoftGraph.getGraphClient("graph");
  if (!graphClient) {
    throw new Error("Failed to get Microsoft Graph client");
  }

  try {
    const drive = await graphClient.api("/me/drive").get();
    const driveId = drive?.id;

    if (!driveId) {
      throw new Error("Failed to get drive ID");
    }

    return { driveId, graphClient };
  } catch (error) {
    console.error("Failed to get drive ID:", error);
    throw new Error("Failed to access Microsoft Graph drive");
  }
};

export const createSharepointSearchTool = (
  userId: string,
  db: NodePgDatabase<typeof import("../../../config/schema")>
) =>
  tool({
    description: `Sharepoint File Search. This tool allows you to search for files and folders within the user's SharePoint drive based on a query string. 

**Example Uses:**
1. Search for a specific file by name:
{
  "query": "Q2 Financial Report",
  "limit": 10
}

2. Search for technical specs or product sheets:
{
  "query": "VRF system datasheet",
  "limit": 10
}

**Tips:**
- Returned IDs can be used with other SharePoint tools to load or manage the files
- Use product names, file types, or project titles when known
- Limit is the maximum number of files to return, default is 10, max is 25`,

    parameters: z.object({
      query: z.string(),
      limit: z.number().nullable(),
    }),
    execute: async ({ query, limit }) => {
      try {
        if (!query.trim()) {
          return { files: [] };
        }

        const { driveId, graphClient } = await getDriveIdAndClient(userId);

        const encodedSearch = encodeURIComponent(query);
        const response = await graphClient
          .api(`/drives/${driveId}/root/search(q='${encodedSearch}')`)
          .top(limit ?? 10)
          .get();

        const files = response.value || [];
        const formattedFiles = formatGraphDriveItems(files);
        return {
          files: formattedFiles,
        };
      } catch (error) {
        console.error("Search error:", error);
        return { error: "Failed to search files" };
      }
    },
  });

export const createSharepointListTool = (
  userId: string,
  db: NodePgDatabase<typeof import("../../../config/schema")>
) =>
  tool({
    description: `Sharepoint List tool. This tool allows you to list the contents of a folder in the user’s SharePoint drive, helping you explore the directory structure or view files in a known path.

**What it does:**
- Lists files and folders in a specified SharePoint path
- If no path is provided, it defaults to the root directory
- Returns metadata for each item (Name, Type (file or folder), Size, Web URL, Unique ID)

**Example Uses:**
1. List root directory contents:
{
  "path": null
}

2. Explore subfolders within a known directory:
{
  "path": "/Engineering/Specs"
}

**Tips:**
- Paths are case-sensitive and must reflect actual SharePoint folder names
- Combine with sharepoint_search or file-loading tools for full file management`,
    parameters: z.object({
      path: z.string().nullable(),
    }),
    execute: async ({ path }) => {
      try {
        const { driveId, graphClient } = await getDriveIdAndClient(userId);

        let apiPath = `/drives/${driveId}/root/children`;

        if (path && path !== "/") {
          const encodedPath = encodeURIComponent(path);
          apiPath = `/drives/${driveId}/root:/${encodedPath}:/children`;
        }

        const response = await graphClient.api(apiPath).get();
        const files = response.value || [];

        // Format files to only include essential information
        const formattedFiles = formatGraphDriveItems(files);

        return {
          files: formattedFiles,
        };
      } catch (error) {
        console.error("List folder error:", error);
        return { error: "Failed to list folder contents" };
      }
    },
  });

const formatGraphDriveItems = (items: GraphDriveItem[]) => {
  return items.map((item) => ({
    name: item.name,
    id: item.id,
    type: item.folder ? "folder" : "file",
    size: item.size,
    lastModified: item.lastModifiedDateTime,
    webUrl: item.webUrl,
  }));
};

/**
 * Creates and returns the complete SharePoint tool set
 * @param userId - The user ID for Microsoft Graph authentication
 * @param db - Database connection for caching and storage
 * @returns Object containing all SharePoint tools
 */
export const createSharepointToolSet = (
  userId: string,
  db: NodePgDatabase<typeof import("../../../config/schema")>
) => {
  return {
    sharepoint_search: createSharepointSearchTool(userId, db),
    sharepoint_ls: createSharepointListTool(userId, db),
    // Removed sharepoint_open_file - consolidated into artifact service load_file_content tool
  };
};

/**
 * Downloads and processes a SharePoint file, storing it in the database
 * @param sharePointFileId - The SharePoint file ID
 * @param userId - The user ID for Microsoft Graph authentication
 * @returns The processed file record
 */
export async function processSharePointFile(
  sharePointFileId: string,
  userId: string
): Promise<any> {
  console.log(`🔍 [SharePoint] Loading SharePoint file: ${sharePointFileId}`);

  // Get SharePoint file metadata
  const microsoftGraph = new MicrosoftAPI({ userId });
  const accessToken = await microsoftGraph.getAccessToken("graph");

  if (!accessToken) {
    throw new Error("No Microsoft Graph access token available");
  }

  const graphClient = await microsoftGraph.getGraphClient("graph");
  if (!graphClient) {
    throw new Error("Failed to get Microsoft Graph client");
  }

  // Get drive ID
  const drive = await graphClient.api("/me/drive").get();
  const driveId = drive?.id;
  if (!driveId) {
    throw new Error("Failed to get drive ID");
  }

  // Get file metadata
  const fileMetadata = await graphClient
    .api(`/drives/${driveId}/items/${sharePointFileId}`)
    .get();

  if (!fileMetadata["@microsoft.graph.downloadUrl"]) {
    throw new Error("No download URL available for this SharePoint file.");
  }

  const filePath = fileMetadata.parentReference?.path
    ? fileMetadata.parentReference.path + "/" + fileMetadata.name
    : fileMetadata.name;

  console.log(
    `📥 [SharePoint] Downloading and processing SharePoint file: ${fileMetadata.name}`
  );

  // Download the file
  const response = await fetch(fileMetadata["@microsoft.graph.downloadUrl"]);
  if (!response.ok) {
    throw new Error(
      `Failed to download SharePoint file: ${response.statusText}`
    );
  }
  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  // Use the generic processing function
  const result = await processAndStoreFile({
    userId,
    fileName: fileMetadata.name,
    mimeType: fileMetadata.file?.mimeType || "application/octet-stream",
    size: fileMetadata.size,
    fileBuffer: buffer,
    fileOriginType: "sharepoint",
    filePath: filePath,
    deduplicationStrategy: "path",
    pathColumn: "sharepoint_path",
  });

  console.log(
    `✅ [SharePoint] SharePoint file processed and stored: ${result.name}`
  );

  // Return in the same format as the original handleSharePointFile method
  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    size: result.size,
    type: "file",
    sharepoint_path: filePath,
    file_origin_type: "sharepoint",
    category: result.category,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
