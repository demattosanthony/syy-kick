import { tool } from "ai";
import { z } from "zod";
import { GraphDriveItem, MicrosoftAPI } from "../../../config/microsoft";

export const createSharepointSearchTool = (
  accessToken: string,
  driveId: string,
  microsoftAPI: MicrosoftAPI
) =>
  tool({
    description: "Search for files and folders in the user's SharePoint drive",
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
    description: "List files and folders in the user's SharePoint drive",
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
