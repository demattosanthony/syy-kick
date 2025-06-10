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
      description: `**LOAD FILE CONTENT TOOL**

**Purpose:** 
Access and display content from files in this conversation thread or SharePoint. This is your main tool for reading documents, images, and data.

**When to use:**
- Reading or analyzing file content
- Accessing PDFs, documents, spreadsheets, or images
- Examining specific files mentioned by the user
- IMPORTANT: Use this tool for engineering drawings/CAD files (stored as images)

**File Types & How to Access:**
• PDFs & Drawings: Use page numbers (startPage/endPage)
• Text & Spreadsheets: Use chunks (startChunk/endChunk)
• Images: Load as single page/chunk

**Required Parameters:**
• fileName: File identifier (required unless using SharePoint)
• sharePointFileId: SharePoint file ID (required unless using fileName)
• startPage/endPage: For PDFs/drawings (1-indexed)
• startChunk/endChunk: For text files (1-indexed)

**Example Uses:**
1. Load full file:
   fileName: "document.pdf", sharePointFileId: null, startPage: null, endPage: null, startChunk: null, endChunk: null

2. Load PDF pages 5-10:
   fileName: "report.pdf", sharePointFileId: null, startPage: 5, endPage: 10, startChunk: null, endChunk: null

3. Load text chunks 1-3:
   fileName: "contract.docx", sharePointFileId: null, startChunk: 1, endChunk: 3, startPage: null, endPage: null

4. Load SharePoint file:
   fileName: null, sharePointFileId: "sp123456", startPage: 1, endPage: 3, startChunk: null, endChunk: null

**Tips:**
- Always include all parameters (use null if not needed)
- Start with small ranges and expand if needed
- For unknown file types, try loading first page/chunk first`,
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

          const result = await getFileContent(file.id, {
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
            // fileId: file.id,
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
      description: `**SEARCH FILE CONTENT TOOL**

**Purpose:** 
Search and find specific information within files in this conversation thread. Returns the most relevant sections matching your query.

**When to use:**
- Finding specific information, keywords, or concepts within a file
- Locating relevant sections without reading entire documents
- Searching for technical terms, specifications, or data points
- Use BEFORE load_file_content when you need to find specific information

**Search Capabilities:**
• Text Documents: Searches through all text content and chunks
• PDFs & Reports: Searches across all pages and sections
• Engineering Drawings: Searches text annotations and descriptions
• Spreadsheets: Searches cell contents and metadata

**Required Parameters:**
• fileName: File identifier to search within
• query: Search terms or phrases to find
• limit: Number of results to return (1-10, default: 5)

**Example Uses:**
1. Find technical data: fileName: "specs.pdf", sharePointFileId: null, query: "operating temperature"
2. Search for people: fileName: "contract.docx", sharePointFileId: null, query: "John Smith OR manager"
3. Locate safety info: fileName: "manual.pdf", sharePointFileId: null, query: "safety precautions warning"
4. Search SharePoint file: fileName: null, sharePointFileId: "sp123456", query: "operating temperature"

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

          const result = await searchFileContent(
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
      description: `**CREATE FILE TOOL**

**Purpose:** 
Create files in the current conversation that will be shared and rendered to the user. Use this to save outputs, deliverables, code, documents, reports, or any content the user might want to download, view, or reference later.

**When to use:**
- Saving analysis results, reports, or summaries from file processing
- Creating code files, scripts, or configuration files
- Generating documentation, specifications, or formatted outputs
- Storing processed data, CSV exports, or structured content
- Creating deliverables that the user requested

**File Types Supported:**
• Text files: .txt, .md, .json, .xml, .csv
• Code files: .py, .js, .ts, .html, .css, .sql
• Data files: .json, .csv, .xml, .yaml
• Configuration files: .config, .env, .ini

**Required Parameters:**
• fileName: Name of the file to create (include extension, add version number if editing an existing file)
• mimeType: MIME type matching the file content
• data: The actual content/data to save in the file

**Example Uses:**
1. Save analysis results: fileName: "analysis_report.md", mimeType: "text/markdown"
2. Create code file: fileName: "script.py", mimeType: "text/x-python"
3. Export data: fileName: "results.csv", mimeType: "text/csv"
4. Generate config: fileName: "settings.json", mimeType: "application/json"

**Tips:**
- Use descriptive filenames with proper extensions
- Match MIME type to file extension and content type
- Include timestamp in filename for multiple versions if needed
- Use this tool for final outputs the user should keep or download
- If the user asks for a spreadsheet, use this tool to create a CSV file`,
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
      load_file_content: this.createLoadFileContentTool(),
      search_file_content: this.createSearchFileContentTool(),
      create_file: this.createFileTool(),
    };
  }
}
