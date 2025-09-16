import { Tool, tool } from "ai";
import { z } from "zod";
import s3 from "../../config/s3";
import { filesOps } from "../files/files.ops";
import { loadImagesForPages } from "../threads/threads.utils";
import type { File } from "../files/files.schemas";
import { processSharePointFile } from "./tool-definitions/sharepoint";
import { v4 as uuidv4 } from "uuid";
import { slugify } from "../../utils";

export type ArtifactData = {
  data: Uint8Array;
  mimeType: string;
};

export type ThreadFile = File;

/**
 * Unified session storage manager for thread-specific file operations.
 * Manages files and provides tools for file access within a conversation thread.
 * Uses unique file names to avoid conflicts with duplicate file names.
 */
export class ArtifactService {
  constructor(
    private threadId: string,
    private userId: string
  ) {}

  async saveArtifact(filename: string, artifact: ArtifactData): Promise<void> {
    const fileSlug = `${slugify(filename)}-${uuidv4().split("-")[0]}`;
    const fileKey = `users/${this.userId}/threads/${fileSlug}`;
    await s3.file(fileKey, { type: artifact.mimeType }).write(artifact.data);
  }

  /**
   * Gets all files available in this thread context (attached to messages in this thread)
   */
  async getThreadFiles(): Promise<ThreadFile[]> {
    console.log(
      `🔍 [ArtifactService] Getting files for thread: ${this.threadId}`
    );

    const result = await filesOps.getFilesForThread(this.threadId, {
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
  async findFileBySlug(fileSlug: string): Promise<ThreadFile | null> {
    const threadFiles = await this.getThreadFiles();
    const file = threadFiles.find(
      (f) => f.syyclops_path?.split("/").pop() === fileSlug
    );
    return file || null;
  }

  // ========== TOOL DEFINITIONS ==========

  private createLoadFileContentTool(): Tool {
    return tool({
      description: `Get files contents. This tool allows you to open and paginate through files from user attachments or a sharepoint integration.
You should use this tool differently depending on the type of file contents you are trying to read. Remember there are two types of files (regular document or engineering drawing).

**Example Uses:**
1. Load PDF pages 5-10 from a PDF:
{
  "fileName": "report.pdf",
  "sharePointFileId": null,
  "startPage": 5,
  "endPage": 10,
  "startChunk": null,
  "endChunk": null
}

2. Load text chunks 1-3 from a word document:
{
  "fileName": "contract.docx",
  "sharePointFileId": null,
  "startPage": null,
  "endPage": null,
  "startChunk": 1,
  "endChunk": 3
}

3. Load SharePoint-hosted drawing pages 1-3:
{
  "fileName": null,
  "sharePointFileId": "sp123456",
  "startPage": 1,
  "endPage": 3,
  "startChunk": null,
  "endChunk": null
}

**Tips:**
- ALWAYS INCLUDE ALL PARAMETERS (you can use null for null values)`,
      parameters: z.object({
        fileName: z
          .string()
          .nullable()
          .describe("File name to load content from"),
        sharePointFileId: z
          .string()
          .nullable()
          .describe("Unique ID of the SharePoint file to load content from"),
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
      }),
      execute: async ({
        fileName,
        sharePointFileId,
        startPage,
        endPage,
        startChunk,
        endChunk,
      }) => {
        try {
          if (!fileName && !sharePointFileId) {
            throw new Error("fileName or sharepointFileId is required");
          }

          let file;

          // Look up the file by slug or SharePoint file ID
          if (sharePointFileId) {
            // Handle SharePoint file
            console.log(
              `📁 [ArtifactService] Loading SharePoint file: ${sharePointFileId}`
            );

            file = await processSharePointFile(sharePointFileId, this.userId);
          } else if (fileName) {
            // Handle regular file attachment
            file = await this.findFileBySlug(fileName);
          } else {
            throw new Error(
              "Either fileName or sharePointFileId must be provided"
            );
          }

          if (!file) {
            console.log(`❌ [ArtifactService] Tool result: File not found`);
            return {
              success: false,
              message: sharePointFileId
                ? `SharePoint file with ID '${sharePointFileId}' not found or could not be processed.`
                : `File '${fileName}' not found in this conversation.`,
            };
          }

          const result = await filesOps.getFileContent(file.id, {
            startPage: startPage ?? undefined,
            endPage: endPage ?? undefined,
            startChunk: startChunk ?? undefined,
            endChunk: endChunk ?? undefined,
          });

          let images: {
            name: string;
            imagePath: string;
            mimeType: string;
          }[] = [];
          if (result.pageIds.length > 0) {
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
            fileName: file.name,
            mimeType: file.mimeType,
            content: result.content,
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
            images: images,
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
      description: `Search file contents. This tool allows you to search for specific information inside a file and returns the most relevant matching sections. 

**Search Capabilities:**
• Text Documents: Searches through all text content and chunks
• PDFs & Reports: Searches across all pages and sections
• Spreadsheets: Searches for rows and specific cell information


**Example Uses:**
1. Find technical data from PDF:
{
  "fileName": "specs.pdf",
  "sharePointFileId": null,
  "query": "operating temperature",
  "limit": 5
}

2. Search a Word document for people mentioned:
{
  "fileName": "contract.docx",
  "sharePointFileId": null,
  "query": "John Smith OR manager",
  "limit": 3
}

3. Locate safety-related info in a manual:
{
  "fileName": "manual.pdf",
  "sharePointFileId": null,
  "query": "safety precautions warning",
  "limit": 5
}

4. Search a SharePoint-hosted file:
{
  "fileName": null,
  "sharePointFileId": "sp123456",
  "query": "operating temperature",
  "limit": 5
}

**Tips:**
- Use specific keywords for precise results
- Start with specific terms, broaden if needed
- Use this tool first to locate info, then load_file_content for full context
- Set limit based on how much content you want to review`,
      parameters: z.object({
        fileName: z
          .string()
          .nullable()
          .describe("The file name to search within"),
        sharePointFileId: z
          .string()
          .nullable()
          .describe("The SharePoint file ID to search within"),
        query: z.string().describe("Search query to find relevant content"),
        limit: z
          .number()
          .nullable()
          .describe("Maximum number of results to return (default: 5)"),
      }),
      execute: async ({ fileName, sharePointFileId, query, limit = 5 }) => {
        try {
          if (!fileName && !sharePointFileId) {
            throw new Error("fileName or sharePointFileId is required");
          }

          // Verify file exists in thread context
          const file = sharePointFileId
            ? await processSharePointFile(sharePointFileId, this.userId)
            : fileName
              ? await this.findFileBySlug(fileName)
              : null;

          if (!file) {
            return {
              success: false,
              message: sharePointFileId
                ? `SharePoint file with ID '${sharePointFileId}' not found or could not be processed.`
                : `File '${fileName}' not found in this conversation.`,
            };
          }

          const result = await filesOps.searchFileContent(
            file.id,
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
          if (result.pageIds.length > 0) {
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

  private createFileTool(): Tool {
    return tool({
      description: `Create a file. This tool allows you to create and return files in the current conversation. It’s ideal for saving results, code, data, or documentation that the user might want to download, keep, or reuse.

**When to use:**
- Save summaries, analysis results, or report findings
- Generate scripts, configuration files, or formatted code
- Export data in structured formats (CSV, JSON, YAML, etc.)
- Deliver final outputs, checklists, specs, or templates requested by the user

**Example Uses:**
1. Save a Markdown analysis report:
{
  "fileName": "analysis_report.md",
  "mimeType": "text/markdown",
  "data": "# Report\n\nSummary of key findings..."
}

2. Create a Python script:
{
  "fileName": "script.py",
  "mimeType": "text/x-python",
  "data": "import ifcopenshell"
}

3. Export CSV data:
{
  "fileName": "results.csv",
  "mimeType": "text/csv",
  "data": "Name,Value\nTemperature,72\nHumidity,40"
}

**Tips:**
- Use clear, descriptive filenames with proper extensions.
- Always match the MIME type to the content and extension.
- For spreadsheets, use .csv as a lightweight and widely supported format.

*This create_file tool only supports regular text files*`,
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
          message: `Successfully created file '${fileName}' with MIME type '${mimeType}'.`,
          identifier: fileName.replace(/\.[^/.]+$/, ""),
          type: mimeType,
          title: fileName,
          content: data,
          created: new Date().toISOString(),
        };
      },
    });
  }

  public getTools(): Record<string, Tool> {
    return {
      //   load_file_content: this.createLoadFileContentTool(),
      //   search_file_content: this.createSearchFileContentTool(),
      create_file: this.createFileTool(),
    };
  }
}
