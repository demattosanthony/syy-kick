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
      create_file: this.createFileTool(),
    };
  }
}
