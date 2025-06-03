import { tool } from "ai";
import { z } from "zod";
import { MicrosoftAPI } from "../../../config/microsoft";
import { markitdown, ocrIt } from "../../../doc-processor-v2";

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

export const createSharepointSearchTool = (
  driveId: string,
  microsoftAPI: MicrosoftAPI
) =>
  tool({
    description:
      "Searches for files and folders within the user's SharePoint drive based on a query string. Use this tool to find specific items by name or keywords. Returns a list of matching files and folders with their metadata (name, id, type, size, last modified date, web URL).",
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const client = await microsoftAPI.getGraphClient("graph");
      if (!client) {
        return { error: "Failed to authenticate with Microsoft Graph" };
      }

      try {
        if (!query.trim()) {
          return { files: [] };
        }

        const encodedSearch = encodeURIComponent(query);
        const response = await client
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
  driveId: string,
  microsoftAPI: MicrosoftAPI
) =>
  tool({
    description:
      "Lists files and folders within a specified path in the user's SharePoint drive. If no path is provided, it lists the contents of the root directory. Use this to explore the folder structure or get a list of items in a known folder. Returns a list of files and folders with their metadata (name, id, type, size, last modified date, web URL).",
    parameters: z.object({
      path: z.string().nullable(),
    }),
    execute: async ({ path }) => {
      const client = await microsoftAPI.getGraphClient("graph");
      if (!client) {
        return { error: "Failed to authenticate with Microsoft Graph" };
      }

      try {
        let apiPath = `/drives/${driveId}/root/children`;

        if (path && path !== "/") {
          const encodedPath = encodeURIComponent(path);
          apiPath = `/drives/${driveId}/root:/${encodedPath}:/children`;
        }

        const response = await client.api(apiPath).get();
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

export const openSharepointFileTool = (
  driveId: string,
  microsoftAPI: MicrosoftAPI
) =>
  tool({
    description:
      "Retrieves and opens a specific file from the user's SharePoint drive using its unique file ID. This tool extracts the content of the file, converting it to a readable format. For PDF files, Optical Character Recognition (OCR) is used to extract text, which is then returned as markdown. For other file types, content is converted to markdown. Use this tool when you need to access and understand the contents of a specific file. The file ID can be obtained from the search or list tools. Returns the file name and its content.",
    parameters: z.object({
      fileId: z.string(),
    }),
    execute: async ({ fileId }) => {
      const client = await microsoftAPI.getGraphClient("graph");
      if (!client) {
        return { error: "Failed to authenticate with Microsoft Graph" };
      }

      try {
        const file = (await client
          .api(`/drives/${driveId}/items/${fileId}`)
          .get()) as GraphDriveItem;

        if (!file["@microsoft.graph.downloadUrl"]) {
          return {
            error: "No download URL available for this file.",
          };
        }

        const response = await fetch(file["@microsoft.graph.downloadUrl"]);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        let content = "";

        if (file.file?.mimeType === "application/pdf") {
          const pdfContent = await ocrIt(buffer, "application/pdf");
          content = pdfContent.markdown;
        } else {
          content = await markitdown(buffer, file.name);
        }

        return {
          fileName: file.name,
          file: content,
        };
      } catch (error) {
        console.error("Open file error:", error);
        return {
          error: "Failed to open file.",
        };
      }
    },
  });
