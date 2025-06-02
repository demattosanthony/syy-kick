import { tool } from "ai";
import { z } from "zod";
import { GraphDriveItem, MicrosoftAPI } from "../../../config/microsoft";
import { markitdown, ocrIt } from "../../../doc-processor-v2";

export const createSharepointSearchTool = (
  accessToken: string,
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
      const files = await microsoftAPI.searchFiles(driveId, query, accessToken);
      const formattedFiles = formatGraphDriveItems(files);
      return {
        files: formattedFiles,
      };
    },
  });

export const createSharepointListTool = (
  accessToken: string,
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
      if (!path) {
        path = "/";
      }
      const files = await microsoftAPI.getFolderContent(
        driveId,
        path,
        accessToken
      );

      // Format files to only include essential information
      const formattedFiles = formatGraphDriveItems(files);

      return {
        files: formattedFiles,
      };
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
  accessToken: string,
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
      try {
        const file = await microsoftAPI.getFile(driveId, fileId, accessToken);

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
        console.error(error);
        return {
          error: "Failed to open file.",
        };
      }
    },
  });
