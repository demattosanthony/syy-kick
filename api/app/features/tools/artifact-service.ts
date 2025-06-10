import { Tool, tool } from "ai";
import { z } from "zod";
import s3 from "../../config/s3";
import {
  getFileContent,
  searchFileContent,
  getFilesForThread,
} from "../files/files.ops";
import { loadImagesForPages } from "../threads/threads.utils";
import type { File } from "../files/files.schemas";

export type ArtifactData = {
  data: Uint8Array;
  mimeType: string;
};

export type ThreadFile = File;

/**
 * Unified session storage manager for thread-specific file operations.
 * Manages artifacts and provides tools for file access within a conversation thread.
 * Uses unique file IDs to avoid conflicts with duplicate file names.
 */
export class ArtifactService {
  constructor(private threadId: string) {}

  private normalizeFilename(filename: string): string {
    return filename.replace(/[\s\u202f]+/g, " ").trim();
  }

  // ========== ARTIFACT MANAGEMENT ==========

  async saveArtifact(filename: string, artifact: ArtifactData): Promise<void> {
    const normalizedFilename = this.normalizeFilename(filename);
    const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
    await s3.file(fileKey, { type: artifact.mimeType }).write(artifact.data);
  }

  async loadArtifact(filename: string): Promise<ArtifactData | undefined> {
    const normalizedFilename = this.normalizeFilename(filename);
    const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
    const file = s3.file(fileKey);

    if (!(await file.exists())) return undefined;

    const stat = await file.stat();
    const data = await file.arrayBuffer();
    return { data: new Uint8Array(data), mimeType: stat.type };
  }

  async listArtifacts(): Promise<string[]> {
    const keys = await s3.list({ prefix: `files/threads/${this.threadId}/` });
    return keys.contents?.map((obj) => obj.key.split("/").pop() ?? "") ?? [];
  }

  async deleteArtifact(filename: string): Promise<boolean> {
    const normalizedFilename = this.normalizeFilename(filename);
    await s3
      .file(`files/threads/${this.threadId}/${normalizedFilename}`)
      .delete();
    return true;
  }

  async clearArtifacts(): Promise<void> {
    const keys = await this.listArtifacts();
    for (const key of keys) {
      await this.deleteArtifact(key);
    }
  }

  async getArtifacts(): Promise<Record<string, ArtifactData>> {
    const keys = await this.listArtifacts();
    const artifacts = await Promise.all(
      keys.map(async (key) => {
        const artifact = await this.loadArtifact(key);
        return [key, artifact];
      })
    );
    return Object.fromEntries(artifacts);
  }

  async adoptS3Object(
    sourceKey: string,
    targetFilename: string,
    mimeType: string
  ): Promise<void> {
    const normalizedTargetFilename = this.normalizeFilename(targetFilename);
    const targetKey = `files/threads/${this.threadId}/${normalizedTargetFilename}`;

    const sourceFile = s3.file(sourceKey);
    if (!(await sourceFile.exists())) {
      throw new Error(`Source object ${sourceKey} not found for adoption.`);
    }

    const data = await sourceFile.arrayBuffer();
    await s3.file(targetKey).write(data, { type: mimeType });
  }

  // ========== THREAD FILE OPERATIONS ==========

  /**
   * Gets all files available in this thread context (attached to messages in this thread)
   */
  async getThreadFiles(): Promise<ThreadFile[]> {
    console.log(
      `🔍 [ArtifactService] Getting files for thread: ${this.threadId}`
    );

    const result = await getFilesForThread(this.threadId, {
      page: 1,
      limit: 1000,
    });

    console.log(
      `✅ [ArtifactService] Found ${result.files.length} files in thread: ${this.threadId}`
    );

    return result.files;
  }

  /**
   * Finds a file by ID in the thread context
   */
  async findFileById(fileId: string): Promise<ThreadFile | null> {
    const threadFiles = await this.getThreadFiles();
    const file = threadFiles.find((f) => f.id === fileId);
    return file || null;
  }

  // ========== TOOL DEFINITIONS ==========

  public getTools(): Record<string, Tool> {
    return {
      //   list_thread_files: this.createListThreadFilesTool(),
      load_file_content: this.createLoadFileContentTool(),
      search_file_content: this.createSearchFileContentTool(),
      create_artifact: this.createArtifactTool(),
    };
  }

  //   private createListThreadFilesTool(): Tool {
  //     return tool({
  //       description:
  //         "Lists all files available in this conversation thread. Use this first to see what files are available and get their IDs.",
  //       parameters: z.object({}),
  //       execute: async () => {
  //         try {
  //           const threadFiles = await this.getThreadFiles();

  //           if (threadFiles.length === 0) {
  //             return {
  //               success: true,
  //               message: "No files found in this conversation thread.",
  //               files: [],
  //             };
  //           }

  //           const fileList = threadFiles.map((file) => ({
  //             id: file.id,
  //             name: file.name,
  //             mimeType: file.mimeType,
  //             size: file.size,
  //             createdAt: file.createdAt?.toISOString(),
  //           }));

  //           return {
  //             success: true,
  //             message: `Found ${threadFiles.length} file(s) in this conversation thread.`,
  //             files: fileList,
  //           };
  //         } catch (error) {
  //           return {
  //             success: false,
  //             message: `Error listing thread files: ${error instanceof Error ? error.message : "Unknown error"}`,
  //             files: [],
  //           };
  //         }
  //       },
  //     });
  //   }

  private createLoadFileContentTool(): Tool {
    return tool({
      description:
        "Loads content from a file attachment or SharePoint file with pagination support. This tool allows you to access processed file content in manageable chunks. For PDF files, you can specify page ranges. For other files, you can specify chunk ranges. Use this to read through large documents systematically. Can also return images of the pages when available. IMPORTANT: This is the PRIMARY tool to use for engineering drawings and files categorized as 'drawing' since they are stored as high-resolution images rather than searchable text. For drawing files, use page-based pagination to navigate through drawing sheets and examine specific details. Provide all parameters in the tool call, even if they should be null.",
      parameters: z.object({
        fileId: z
          .string()
          .describe("Unique ID of the file to load content from"),
        startPage: z
          .number()
          .nullable()
          .describe("Starting page number (for PDFs)"),
        endPage: z
          .number()
          .nullable()
          .describe("Ending page number (for PDFs)"),
        startChunk: z
          .number()
          .nullable()
          .describe("Starting chunk number (for other documents)"),
        endChunk: z
          .number()
          .nullable()
          .describe("Ending chunk number (for other documents)"),
        includeImages: z
          .boolean()
          .nullable()
          .describe("Whether to include images from the content"),
      }),
      execute: async ({
        fileId,
        startPage,
        endPage,
        startChunk,
        endChunk,
        includeImages = true,
      }) => {
        try {
          if (!fileId) {
            throw new Error("fileId is required");
          }

          // Verify file exists in thread context
          const file = await this.findFileById(fileId);
          if (!file) {
            return {
              success: false,
              message: `File with ID '${fileId}' not found in this conversation thread.`,
            };
          }

          const result = await getFileContent(fileId, {
            startPage: startPage ?? undefined,
            endPage: endPage ?? undefined,
            startChunk: startChunk ?? undefined,
            endChunk: endChunk ?? undefined,
          });

          let images: any[] = [];
          if (includeImages && result.pageIds.length > 0) {
            const imageData = await loadImagesForPages(result.pageIds);
            images = imageData.map((img) => ({
              name: img.name,
              imagePath: img.imagePath,
              mimeType: img.mimeType,
            }));
          }

          return {
            success: true,
            message: `Successfully loaded content from '${file.name}' (${result.pageInfo})${images.length ? ` with ${images.length} images` : ""}.`,
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            content: result.content,
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
            images: images,
            fileSource: "attachment",
          };
        } catch (error) {
          return {
            success: false,
            message: `Error loading file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
    });
  }

  private createSearchFileContentTool(): Tool {
    return tool({
      description:
        "Searches through the content of a file using its unique ID. Use list_thread_files first to get the file ID.",
      parameters: z.object({
        fileId: z.string().describe("Unique ID of the file to search within"),
        query: z.string().describe("Search query to find relevant content"),
        limit: z
          .number()
          .nullable()
          .describe("Maximum number of results to return (default: 5)"),
        includeImages: z
          .boolean()
          .nullable()
          .describe("Whether to include images from the search results"),
      }),
      execute: async ({ fileId, query, limit = 5, includeImages = true }) => {
        try {
          if (!fileId) {
            throw new Error("fileId is required");
          }

          // Verify file exists in thread context
          const file = await this.findFileById(fileId);
          if (!file) {
            return {
              success: false,
              message: `File with ID '${fileId}' not found in this conversation thread.`,
            };
          }

          const result = await searchFileContent(
            fileId,
            query,
            Math.min(limit ?? 5, 10)
          );

          if (result.matches === 0) {
            return {
              success: false,
              message: `No content found matching "${query}" in file '${file.name}'.`,
              fileId: file.id,
              fileName: file.name,
              query: query,
              matches: 0,
              images: [],
            };
          }

          let images: any[] = [];
          if (includeImages && result.pageIds.length > 0) {
            const imageData = await loadImagesForPages(result.pageIds);
            images = imageData.map((img) => ({
              name: img.name,
              imagePath: img.imagePath,
              mimeType: img.mimeType,
            }));
          }

          return {
            success: true,
            message: `Found ${result.matches} relevant chunks matching "${query}" in '${file.name}'${images.length ? ` with ${images.length} images` : ""}.`,
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            query: query,
            matches: result.matches,
            content: result.content,
            images: images,
          };
        } catch (error) {
          return {
            success: false,
            message: `Error searching file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
    });
  }

  private createArtifactTool(): Tool {
    return tool({
      description:
        "Creates an artifact (file) in the current conversation session. Use this to save content, code, or documents that the user might want to download or reference later.",
      parameters: z.object({
        fileName: z.string().describe("Name of the file to create"),
        mimeType: z.string().describe("MIME type of the file content"),
        data: z.string().describe("Content data to save in the file"),
      }),
      execute: async ({ fileName, mimeType, data }) => {
        const artifactData = new TextEncoder().encode(data);
        await this.saveArtifact(fileName, { data: artifactData, mimeType });

        return {
          success: true,
          message: `Successfully created artifact '${fileName}' with MIME type '${mimeType}'.`,
          identifier: fileName.replace(/\.[^/.]+$/, ""),
          type: mimeType,
          title: fileName,
          content: data,
          created: new Date().toISOString(),
        };
      },
    });
  }
}
