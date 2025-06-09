import { tool } from "ai";
import { z } from "zod";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { MicrosoftAPI } from "../../../config/microsoft";

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
    description:
      "Searches for files and folders within the user's SharePoint drive based on a query string. Use this tool to find specific items by name or keywords. Returns a list of matching files and folders with their metadata (name, id, type, size, last modified date, web URL).",
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      try {
        if (!query.trim()) {
          return { files: [] };
        }

        const { driveId, graphClient } = await getDriveIdAndClient(userId);

        const encodedSearch = encodeURIComponent(query);
        const response = await graphClient
          .api(`/drives/${driveId}/root/search(q='${encodedSearch}')`)
          .top(25)
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
    description:
      "Lists files and folders within a specified path in the user's SharePoint drive. If no path is provided, it lists the contents of the root directory. Use this to explore the folder structure or get a list of items in a known folder. Returns a list of files and folders with their metadata (name, id, type, size, last modified date, web URL).",
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
