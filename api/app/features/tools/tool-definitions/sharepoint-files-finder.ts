import { tool } from "ai";
import { z } from "zod";
import { MicrosoftAPI } from "../../../config/microsoft";

export const createSharepointFilesFinderTool = ({ userId }: { userId: string }) =>
  tool({
    description: `This tool allows you to search and list files in Microsoft SharePoint.`,
    parameters: z.object({
      searchQuery: z.string().optional().describe("The search query to filter files"),
      folderPath: z.string().optional().describe("The SharePoint folder path to search in (optional)"),
    }),
    execute: async ({ searchQuery, folderPath }) => {
      try {
        const microsoftApi = new MicrosoftAPI({ userId });
        const tokenInfo = await microsoftApi.getAccessToken("graph");

        if (!tokenInfo) {
          return {
            success: false,
            message: "No Microsoft access token found. Please reconnect to Microsoft.",
          };
        }

        const { accessToken } = tokenInfo;
        const site = await microsoftApi.getSite(accessToken);
        
        let searchUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root`;
        if (folderPath) {
          searchUrl += `:/${folderPath}:`;
        }

        if (searchQuery) {
          searchUrl += `/search(q='${encodeURIComponent(searchQuery)}')`;
        }

        const response = await fetch(searchUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`SharePoint error: ${response.statusText}`);
        }

        const data = await response.json();
        
        return {
          success: true,
          files: data.value.map((file: any) => ({
            name: file.name,
            id: file.id,
            webUrl: file.webUrl,
            size: file.size,
            createdDateTime: file.createdDateTime,
            lastModifiedDateTime: file.lastModifiedDateTime,
            type: Object.keys(file.folder || {}).length > 0 ? 'folder' : 'file',
            createdBy: file.createdBy?.user,
            lastModifiedBy: file.lastModifiedBy?.user,
            parentReference: file.parentReference,
            fileSystemInfo: file.fileSystemInfo,
            folder: file.folder,
            searchResult: file.searchResult,
          })),
          nextPage: data['@odata.nextLink'] || null,
          context: data['@odata.context'],
        };
      } catch (error) {
        console.error(`[SharepointFilesFinderTool] Error during search:`, error);
        return {
          success: false,
          message: `SharePoint search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  });
