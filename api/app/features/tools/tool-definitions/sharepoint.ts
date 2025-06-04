import { tool } from "ai";
import { z } from "zod";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "@microsoft/microsoft-graph-client";
import { FilePage, processFile } from "../../../doc-processor-v2";

import { eq } from "drizzle-orm";
import {
  filePageChunks,
  filePageImages,
  filePages,
  files,
} from "../../../config/schema";
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
  graphClient: Client
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
  driveId: string,
  graphClient: Client
) =>
  tool({
    description:
      "Lists files and folders within a specified path in the user's SharePoint drive. If no path is provided, it lists the contents of the root directory. Use this to explore the folder structure or get a list of items in a known folder. Returns a list of files and folders with their metadata (name, id, type, size, last modified date, web URL).",
    parameters: z.object({
      path: z.string().nullable(),
    }),
    execute: async ({ path }) => {
      try {
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

const getFileFromCache = async (
  tx: NodePgDatabase<typeof import("../../../config/schema")> | undefined,
  filePath: string | undefined
) => {
  if (!tx || !filePath) return null;

  const existingFile = await tx.query.files.findFirst({
    where: eq(files.sharepoint_path, filePath),
  });

  if (existingFile) {
    const pages = await tx.query.filePages.findMany({
      where: eq(filePages.fileId, existingFile.id),
      with: {
        chunks: true,
        images: true,
      },
    });

    if (pages && pages.length > 0) {
      return {
        fileName: existingFile.name,
        file: pages.map(
          (page) => page.chunks.map((chunk) => chunk.content).join("\n") + "\n"
        ),
      };
    }
  }

  return null;
};

const downloadAndProcessFile = async (
  file: GraphDriveItem,
  downloadUrl: string
): Promise<FilePage[]> => {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  const blob = await response.blob();
  const buffer = Buffer.from(await blob.arrayBuffer());

  const filePages = await processFile(
    buffer,
    file.name,
    file.file?.mimeType || "application/octet-stream"
  );

  return filePages;
};

const storeFileInDb = async (
  tx: NodePgDatabase<typeof import("../../../config/schema")> | undefined,
  file: GraphDriveItem
) => {
  if (!tx) return null; // Or throw an error if tx is mandatory for this operation

  const filePath = file.parentReference?.path
    ? file.parentReference.path + "/" + file.name
    : file.name; // Handle cases where parentReference or path might be undefined

  const insertedFile = await tx
    .insert(files)
    .values({
      name: file.name,
      mimeType: file.file?.mimeType || "application/octet-stream",
      size: file.size,
      type: "file",
      sharepoint_path: filePath,
      file_origin_type: "sharepoint",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!insertedFile || insertedFile.length === 0) {
    // Consider throwing an error here if insertion is critical
    return null;
  }

  return insertedFile[0];
};

export const openSharepointFileTool = (
  driveId: string,
  graphClient: Client,
  tx: NodePgDatabase<typeof import("../../../config/schema")>
) =>
  tool({
    description:
      "Retrieves and opens a specific file from the user's SharePoint drive using its unique file ID. This tool extracts the content of the file, converting it to a readable format. For PDF files, Optical Character Recognition (OCR) is used to extract text, which is then returned as markdown. For other file types, content is converted to markdown. Use this tool when you need to access and understand the contents of a specific file. The file ID can be obtained from the search or list tools. Returns the file name and its content.",
    parameters: z.object({
      fileId: z.string(),
    }),
    execute: async ({ fileId }) => {
      try {
        const fileMetadata = (await graphClient
          .api(`/drives/${driveId}/items/${fileId}`)
          .get()) as GraphDriveItem;

        if (!fileMetadata["@microsoft.graph.downloadUrl"]) {
          return {
            error: "No download URL available for this file.",
          };
        }

        const filePath = fileMetadata.parentReference?.path
          ? fileMetadata.parentReference.path + "/" + fileMetadata.name
          : fileMetadata.name; // Handle cases where parentReference or path might be undefined

        const cachedFile = await getFileFromCache(tx, filePath);
        if (cachedFile) {
          console.log("Cached file found");
          return cachedFile;
        }

        console.log("No cached file found, downloading and processing file");

        const pages = await downloadAndProcessFile(
          fileMetadata,
          fileMetadata["@microsoft.graph.downloadUrl"]
        );

        const insertedFile = await storeFileInDb(tx, fileMetadata);

        if (!insertedFile) {
          return {
            error: "Failed to store file in database",
          };
        }

        for (const pageData of pages) {
          // Insert the file page and get its ID
          const insertedDbPageResult = await tx
            .insert(filePages)
            .values({
              fileId: insertedFile.id,
              pageNumber: pageData.pageNumber,
            })
            .returning({ id: filePages.id });

          if (!insertedDbPageResult || insertedDbPageResult.length === 0) {
            console.error(
              `Failed to insert page number ${pageData.pageNumber} for file ${insertedFile.name} into database.`
            );
            // Depending on requirements, might continue to next page, or abort.
            // Aborting to prevent partial data.
            return {
              error: `Failed to store page ${pageData.pageNumber} data.`,
            };
          }
          const dbPageId = insertedDbPageResult[0].id;

          // Save the file chunks for this page
          if (pageData.chunks && pageData.chunks.length > 0) {
            const chunkValues = pageData.chunks.map((chunk) => ({
              filePageId: dbPageId,
              content: chunk.content,
              position: chunk.position,
            }));
            if (chunkValues.length > 0) {
              await tx.insert(filePageChunks).values(chunkValues);
            }
          }

          // Save the file images for this page
          if (pageData.images && pageData.images.length > 0) {
            const imageValues = pageData.images.map((image) => ({
              filePageId: dbPageId,
              name: image.name,
              imagePath: image.path,
              size: image.size,
            }));
            if (imageValues.length > 0) {
              await tx.insert(filePageImages).values(imageValues);
            }
          }
        }

        return {
          fileName: fileMetadata.name,
          file: pages.map(
            (page) =>
              page.chunks.map((chunk) => chunk.content).join("\n") + "\n"
          ),
        };
      } catch (error) {
        console.error("Open file error:", error);
        // It's good practice to return a more specific error or log the error for diagnostics
        const errorMessage =
          error instanceof Error ? error.message : "Failed to open file.";
        return {
          error: errorMessage,
        };
      }
    },
  });
