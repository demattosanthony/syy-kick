import { Tool, tool } from "ai";
import { z } from "zod";
import s3 from "../../config/s3";
import db from "../../config/db";
import { eq, and, like, or } from "drizzle-orm";
import {
  files as filesTable,
  filePages,
  filePageChunks,
  filePageImages,
} from "../../config/schema";
import reranker from "../../config/reranker";

export type ArtifactData = {
  data: Uint8Array;
  mimeType: string;
};

export type ArtifactEvent = {
  type: "created";
  filename: string;
  mimeType: string;
  fileKey: string;
  stepId: string;
  ts: number;
  url: string;
};

export class ArtifactService {
  constructor(private threadId: string) {}

  private normalizeFilename(filename: string): string {
    // Replace various whitespace characters (including narrow no-break space \u202f,
    // tabs, multiple spaces) with a single standard space. Also, trim leading/trailing whitespace.
    return filename.replace(/[\s\u202f]+/g, " ").trim();
  }

  /**
   * Saves an artifact to S3
   * If an artifact with the same filename already exists, it will be overwritten.
   * @param filename The unique identifier for the artifact.
   * @param artifact The artifact data (bytes and MIME type).
   */
  async saveArtifact(
    filename: string,
    artifact: ArtifactData,
    triggerEvent: boolean = true
  ): Promise<void> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
      await s3
        .file(fileKey, {
          type: artifact.mimeType,
        })
        .write(artifact.data);
    } catch (error) {
      console.error("Failed to save artifact:", error);
      throw error;
    }
  }

  /**
   * Loads an artifact from S3
   * @param filename The unique identifier for the artifact.
   * @returns The artifact data if found, otherwise undefined.
   */
  async loadArtifact(filename: string): Promise<ArtifactData | undefined> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      const fileKey = `files/threads/${this.threadId}/${normalizedFilename}`;
      const file = s3.file(fileKey);
      if (await file.exists()) {
        const stat = await file.stat();
        const data = await file.arrayBuffer();
        return {
          data: new Uint8Array(data),
          mimeType: stat.type,
        };
      } else {
        return undefined;
      }
    } catch (error) {
      console.error("Failed to load artifact:", error);
      throw error;
    }
  }

  /**
   * Lists the filenames of all artifacts currently stored in memory.
   * @returns An array of artifact filenames.
   */
  async listArtifacts(): Promise<string[]> {
    try {
      const keys = await s3.list({
        prefix: `files/threads/${this.threadId}/`,
      });
      return keys.contents?.map((obj) => obj.key.split("/").pop() ?? "") ?? [];
    } catch (error) {
      console.error("Failed to list artifacts:", error);
      throw error;
    }
  }

  /**
   * Deletes an artifact from the in-memory storage.
   * @param filename The unique identifier for the artifact.
   * @returns True if the artifact was deleted, false if it wasn't found.
   */
  async deleteArtifact(filename: string): Promise<boolean> {
    try {
      const normalizedFilename = this.normalizeFilename(filename);
      await s3
        .file(`files/threads/${this.threadId}/${normalizedFilename}`)
        .delete();
      return true;
    } catch (error) {
      console.error("Failed to delete artifact:", error);
      throw error;
    }
  }

  /**
   * Clears all artifacts from S3
   */
  async clearArtifacts(): Promise<void> {
    try {
      const keys = await this.listArtifacts();
      for (const key of keys) {
        await this.deleteArtifact(key);
      }
    } catch (error) {
      console.error("Failed to clear artifacts:", error);
      throw error;
    }
  }

  /**
   * Get all artifacts from S3 storage path of the workflow run.
   * @returns An array of artifacts.
   */
  async getArtifacts(): Promise<Record<string, ArtifactData>> {
    try {
      const keys = await this.listArtifacts();
      const artifacts = await Promise.all(
        keys.map(async (key) => {
          const artifact = await this.loadArtifact(key);
          return [key, artifact];
        })
      );
      return Object.fromEntries(artifacts);
    } catch (error) {
      console.error("Failed to get artifacts:", error);
      throw error;
    }
  }

  /**
   * Copies an existing S3 object into the artifact storage for this step,
   * effectively "adopting" it without re-uploading the data.
   * @param sourceKey The full S3 key of the object to copy.
   * @param targetFilename The desired filename for the artifact within this step.
   * @param mimeType The MIME type of the object being copied.
   */
  async adoptS3Object(
    sourceKey: string,
    targetFilename: string,
    mimeType: string
  ): Promise<void> {
    const normalizedTargetFilename = this.normalizeFilename(targetFilename);
    const targetKey = `files/threads/${this.threadId}/${normalizedTargetFilename}`;
    try {
      const sourceFile = s3.file(sourceKey);
      if (!(await sourceFile.exists())) {
        throw new Error(`Source object ${sourceKey} not found for adoption.`);
      }
      const data = await sourceFile.arrayBuffer();

      const targetFile = s3.file(targetKey);
      await targetFile.write(data, {
        type: mimeType,
      });

      //   await sourceFile.delete(); // can't delete because its break the workflow input value file url
    } catch (error) {
      console.error(
        `Failed to adopt S3 object from ${sourceKey} to ${targetKey}:`,
        error
      );
      throw error;
    }
  }

  // --- Tool Creation Methods (now private inside the class) ---

  private listArtifactsTool(): Tool {
    return tool({
      description: "Lists the filenames of all currently available artifacts.",
      parameters: z.object({}).describe("No parameters required."),
      execute: async () => {
        try {
          const filenames = await this.listArtifacts();
          return { filenames: filenames };
        } catch (error: any) {
          console.error("Error in listArtifactsTool:", error);
          return {
            success: false,
            message: `Failed to list artifacts: ${error.message}`,
          };
        }
      },
    });
  }

  /**
   * Find a file by name in the current thread's messages
   */
  private async findFileByName(fileName: string) {
    console.log(`🔍 [ArtifactService] Looking for file: "${fileName}"`);

    // First try exact match
    let file = await db.query.files.findFirst({
      where: eq(filesTable.name, fileName),
    });

    if (file) {
      console.log(
        `✅ [ArtifactService] Found exact match: "${file.name}" (ID: ${file.id}, Type: ${file.mimeType})`
      );
      return file;
    }

    console.log(
      `⚠️ [ArtifactService] No exact match found, trying fuzzy search...`
    );

    // If not found, try case-insensitive partial match
    const allFiles = await db.query.files.findMany();
    console.log(
      `📂 [ArtifactService] Searching through ${allFiles.length} available files`
    );

    const foundFile = allFiles.find(
      (f) =>
        f.name.toLowerCase().includes(fileName.toLowerCase()) ||
        fileName.toLowerCase().includes(f.name.toLowerCase())
    );

    if (foundFile) {
      console.log(
        `✅ [ArtifactService] Found fuzzy match: "${foundFile.name}" (ID: ${foundFile.id}, Type: ${foundFile.mimeType})`
      );
      file = foundFile;
    } else {
      console.log(`❌ [ArtifactService] No file found matching "${fileName}"`);
      console.log(
        `📝 [ArtifactService] Available files: ${allFiles.map((f) => f.name).join(", ")}`
      );
    }

    return file || null;
  }

  /**
   * Get paginated content from a file
   */
  private async getFileContent(
    file: any,
    startPage?: number,
    endPage?: number,
    startChunk?: number,
    endChunk?: number
  ): Promise<{
    content: string;
    totalPages: number;
    totalChunks: number;
    pageInfo?: string;
  }> {
    console.log(
      `📖 [ArtifactService] Loading content from file: "${file.name}" (${file.mimeType})`
    );
    console.log(
      `📊 [ArtifactService] Pagination params - startPage: ${startPage}, endPage: ${endPage}, startChunk: ${startChunk}, endChunk: ${endChunk}`
    );

    // Get all pages for this file
    const pages = await db.query.filePages.findMany({
      where: eq(filePages.fileId, file.id),
      with: {
        chunks: {
          orderBy: (chunks, { asc }) => [asc(chunks.position)],
        },
      },
      orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
    });

    console.log(
      `📄 [ArtifactService] Found ${pages.length} pages for file "${file.name}"`
    );

    if (pages.length === 0) {
      console.log(
        `⚠️ [ArtifactService] No content found for file "${file.name}"`
      );
      return {
        content: "No content found for this file.",
        totalPages: 0,
        totalChunks: 0,
      };
    }

    const totalPages = pages.length;
    const totalChunks = pages.reduce(
      (sum, page) => sum + page.chunks.length,
      0
    );

    console.log(
      `📊 [ArtifactService] File stats - Total pages: ${totalPages}, Total chunks: ${totalChunks}`
    );

    // Handle PDF-style pagination (by pages)
    if (
      file.mimeType === "application/pdf" &&
      (startPage !== undefined || endPage !== undefined)
    ) {
      console.log(`🔖 [ArtifactService] Using PDF page-based pagination`);
      const start = Math.max((startPage || 1) - 1, 0); // Convert to 0-based
      const end = Math.min((endPage || totalPages) - 1, totalPages - 1);

      console.log(
        `📖 [ArtifactService] Loading pages ${start + 1} to ${end + 1}`
      );

      const selectedPages = pages.slice(start, end + 1);
      const content = selectedPages
        .map((page) => {
          const pageContent = page.chunks
            .map((chunk) => chunk.content)
            .join("\n");
          console.log(
            `📄 [ArtifactService] Page ${page.pageNumber}: ${page.chunks.length} chunks, ${pageContent.length} chars`
          );
          return `=== Page ${page.pageNumber} ===\n${pageContent}`;
        })
        .join("\n\n");

      const pageInfo = `Pages ${start + 1}-${end + 1} of ${totalPages}`;
      console.log(
        `✅ [ArtifactService] Returned ${selectedPages.length} pages (${content.length} chars)`
      );

      return { content, totalPages, totalChunks, pageInfo };
    }

    // Handle chunk-based pagination (for non-PDF files or when chunk range is specified)
    if (startChunk !== undefined || endChunk !== undefined) {
      console.log(`🧩 [ArtifactService] Using chunk-based pagination`);
      const allChunks = pages.flatMap((page) =>
        page.chunks.map((chunk) => ({
          ...chunk,
          pageNumber: page.pageNumber,
        }))
      );

      const start = Math.max((startChunk || 1) - 1, 0); // Convert to 0-based
      const end = Math.min(
        (endChunk || allChunks.length) - 1,
        allChunks.length - 1
      );

      console.log(
        `🧩 [ArtifactService] Loading chunks ${start + 1} to ${end + 1} of ${allChunks.length}`
      );

      const selectedChunks = allChunks.slice(start, end + 1);
      const content = selectedChunks
        .map((chunk, index) => {
          const chunkNum = start + index + 1;
          console.log(
            `🧩 [ArtifactService] Chunk ${chunkNum} (Page ${chunk.pageNumber}): ${chunk.content.length} chars`
          );
          return `=== Chunk ${chunkNum} (Page ${chunk.pageNumber}) ===\n${chunk.content}`;
        })
        .join("\n\n");

      const pageInfo = `Chunks ${start + 1}-${end + 1} of ${totalChunks}`;
      console.log(
        `✅ [ArtifactService] Returned ${selectedChunks.length} chunks (${content.length} chars)`
      );

      return { content, totalPages, totalChunks, pageInfo };
    }

    // Default: return first page or first few chunks
    if (file.mimeType === "application/pdf") {
      console.log(
        `📖 [ArtifactService] Using default PDF mode - returning first page`
      );
      const firstPage = pages[0];
      const content = `=== Page 1 ===\n${firstPage.chunks.map((chunk) => chunk.content).join("\n")}`;
      const pageInfo = `Page 1 of ${totalPages}`;
      console.log(
        `✅ [ArtifactService] Returned page 1 (${content.length} chars)`
      );
      return { content, totalPages, totalChunks, pageInfo };
    } else {
      console.log(
        `🧩 [ArtifactService] Using default non-PDF mode - returning first 3 chunks`
      );
      const allChunks = pages.flatMap((page) => page.chunks);
      const firstFewChunks = allChunks.slice(0, 3); // Show first 3 chunks by default
      const content = firstFewChunks
        .map((chunk, index) => {
          return `=== Chunk ${index + 1} ===\n${chunk.content}`;
        })
        .join("\n\n");
      const pageInfo = `Chunks 1-${firstFewChunks.length} of ${totalChunks}`;
      console.log(
        `✅ [ArtifactService] Returned ${firstFewChunks.length} chunks (${content.length} chars)`
      );
      return { content, totalPages, totalChunks, pageInfo };
    }
  }

  /**
   * Search through file content and return relevant chunks
   */
  private async searchFileContent(
    file: any,
    query: string,
    limit: number = 5
  ): Promise<{ content: string; matches: number }> {
    console.log(
      `🔍 [ArtifactService] Searching file "${file.name}" for: "${query}" (limit: ${limit})`
    );

    // Get all chunks for this file
    const pages = await db.query.filePages.findMany({
      where: eq(filePages.fileId, file.id),
      with: {
        chunks: {
          orderBy: (chunks, { asc }) => [asc(chunks.position)],
        },
      },
      orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
    });

    if (pages.length === 0) {
      console.log(
        `⚠️ [ArtifactService] No content found for search in file "${file.name}"`
      );
      return { content: "No content found for this file.", matches: 0 };
    }

    // Flatten all chunks and prepare for reranking
    const allChunks = pages.flatMap((page) =>
      page.chunks.map((chunk) => ({
        ...chunk,
        pageNumber: page.pageNumber,
      }))
    );

    console.log(
      `📊 [ArtifactService] Searching through ${allChunks.length} chunks across ${pages.length} pages`
    );

    if (allChunks.length === 0) {
      console.log(`⚠️ [ArtifactService] No chunks found for reranking`);
      return { content: `No content found matching "${query}".`, matches: 0 };
    }

    // Prepare chunks for reranking
    const chunkTexts = allChunks.map((chunk) => chunk.content);
    const maxLimit = Math.min(limit, 10); // Cap at 10 results

    console.log(
      `🤖 [ArtifactService] Using Jina AI reranker with topN: ${maxLimit}`
    );

    try {
      // Use Jina AI reranker for semantic search
      const rerankedResults = await reranker.rerank(query, chunkTexts, {
        topN: maxLimit,
        returnDocuments: true,
      });

      if (!rerankedResults.results || rerankedResults.results.length === 0) {
        console.log(
          `❌ [ArtifactService] No matches found by reranker for query "${query}"`
        );
        return { content: `No content found matching "${query}".`, matches: 0 };
      }

      console.log(
        `✅ [ArtifactService] Reranker returned ${rerankedResults.results.length} results`
      );

      // Map reranker results back to original chunks with metadata
      const rankedChunks = rerankedResults.results
        .map((result, index) => {
          // Find the original chunk by matching content
          const originalChunk = allChunks.find(
            (chunk) => chunk.content === result.document.text
          );

          if (!originalChunk) {
            console.warn(
              `⚠️ [ArtifactService] Could not find original chunk for reranked result ${index + 1}`
            );
            return null;
          }

          console.log(
            `   ${index + 1}. Page ${originalChunk.pageNumber}, Score: ${result.relevance_score.toFixed(3)}, Content preview: "${originalChunk.content.substring(0, 100)}..."`
          );

          return {
            ...originalChunk,
            score: result.relevance_score,
          };
        })
        .filter((chunk) => chunk !== null);

      if (rankedChunks.length === 0) {
        console.log(
          `❌ [ArtifactService] No valid chunks after mapping reranker results`
        );
        return { content: `No content found matching "${query}".`, matches: 0 };
      }

      console.log(
        `✅ [ArtifactService] Returning top ${rankedChunks.length} semantically ranked matches:`
      );

      const content = rankedChunks
        .map((chunk, index) => {
          return `=== Match ${index + 1} (Page ${chunk.pageNumber}, Relevance: ${chunk.score.toFixed(3)}) ===\n${chunk.content}`;
        })
        .join("\n\n");

      console.log(
        `📄 [ArtifactService] Total response length: ${content.length} characters`
      );
      return { content, matches: rankedChunks.length };
    } catch (error) {
      console.error(`❌ [ArtifactService] Reranker error:`, error);
      console.log(`🔄 [ArtifactService] Falling back to simple text search`);

      // Fallback to simple text search if reranker fails
      const searchTerms = query
        .toLowerCase()
        .split(" ")
        .filter((term) => term.length > 2);
      console.log(
        `🔍 [ArtifactService] Fallback search terms: [${searchTerms.join(", ")}]`
      );

      const scoredChunks = allChunks
        .map((chunk) => {
          const chunkText = chunk.content.toLowerCase();
          let score = 0;

          // Score based on search term matches
          searchTerms.forEach((term) => {
            const matches = (chunkText.match(new RegExp(term, "g")) || [])
              .length;
            score += matches;
          });

          // Boost score for exact phrase matches
          if (chunkText.includes(query.toLowerCase())) {
            score += 10;
          }

          return { ...chunk, score };
        })
        .filter((chunk) => chunk.score > 0);

      // Sort by relevance and take top results
      const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (topChunks.length === 0) {
        console.log(
          `❌ [ArtifactService] No matches found with fallback search for query "${query}"`
        );
        return { content: `No content found matching "${query}".`, matches: 0 };
      }

      console.log(
        `✅ [ArtifactService] Fallback search returned ${topChunks.length} matches`
      );

      const content = topChunks
        .map((chunk, index) => {
          return `=== Match ${index + 1} (Page ${chunk.pageNumber}, Score: ${chunk.score}) ===\n${chunk.content}`;
        })
        .join("\n\n");

      return { content, matches: topChunks.length };
    }
  }

  private loadArtifactTool(): Tool {
    return tool({
      description:
        "Loads content from a file attachment with pagination support. This tool allows you to access processed file content in manageable chunks. For PDF files, you can specify page ranges. For other files, you can specify chunk ranges. Use this to read through large documents systematically.",
      parameters: z.object({
        fileName: z
          .string()
          .describe("The file name of the attachment to load."),
        startPage: z
          .number()
          .optional()
          .describe(
            "For PDF files: starting page number (1-based). If not specified, shows first page."
          ),
        endPage: z
          .number()
          .optional()
          .describe(
            "For PDF files: ending page number (1-based). If not specified, shows only start page."
          ),
        startChunk: z
          .number()
          .optional()
          .describe(
            "For non-PDF files or specific chunk access: starting chunk number (1-based)."
          ),
        endChunk: z
          .number()
          .optional()
          .describe(
            "For non-PDF files or specific chunk access: ending chunk number (1-based)."
          ),
      }),
      execute: async ({
        fileName,
        startPage,
        endPage,
        startChunk,
        endChunk,
      }) => {
        console.log(`🚀 [ArtifactService] load_file_content tool called`);
        console.log(`📋 [ArtifactService] Parameters:`, {
          fileName,
          startPage,
          endPage,
          startChunk,
          endChunk,
        });

        try {
          const file = await this.findFileByName(fileName);
          if (!file) {
            console.log(`❌ [ArtifactService] Tool result: File not found`);
            return {
              success: false,
              message: `File '${fileName}' not found in this conversation.`,
            };
          }

          const result = await this.getFileContent(
            file,
            startPage,
            endPage,
            startChunk,
            endChunk
          );

          console.log(
            `✅ [ArtifactService] Tool result: Successfully loaded content`
          );
          console.log(`📊 [ArtifactService] Result stats:`, {
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
            contentLength: result.content.length,
          });

          return {
            success: true,
            message: `Successfully loaded content from '${fileName}' (${result.pageInfo}).`,
            fileName: file.name,
            mimeType: file.mimeType,
            content: result.content,
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
          };
        } catch (error) {
          console.error(`❌ [ArtifactService] Tool error:`, error);
          return {
            success: false,
            message: `Error loading file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
    });
  }

  private createArtifactTool(): Tool {
    return tool({
      description:
        "Creates an artifact in the artifact service. Use this to save substantial, self-contained content like documents, code, diagrams, or data that users might modify or reuse.",
      parameters: z.object({
        fileName: z
          .string()
          .describe(
            "The name of the artifact (e.g., 'report.md', 'data.csv')."
          ),
        mimeType: z
          .string()
          .describe("The MIME type (e.g., 'text/markdown', 'text/csv')."),
        data: z
          .string()
          .describe("The plain text content. Do not base64 encode."),
      }),
      execute: async ({ fileName, mimeType, data }) => {
        const artifactData = new TextEncoder().encode(data);
        await this.saveArtifact(fileName, {
          data: artifactData,
          mimeType,
        });

        // Return artifact data for frontend display
        return {
          success: true,
          message: `Successfully created artifact '${fileName}' with MIME type '${mimeType}'.`,
          // Frontend artifact data
          identifier: fileName.replace(/\.[^/.]+$/, ""), // Remove file extension for identifier
          type: mimeType,
          title: fileName,
          content: data,
          created: new Date().toISOString(),
        };
      },
    });
  }

  private searchFileContentTool(): Tool {
    return tool({
      description:
        "Searches through the content of a file attachment to find relevant information. This tool performs text-based search through the processed content and returns the most relevant chunks. Use this when you need to find specific information within a large document.",
      parameters: z.object({
        fileName: z
          .string()
          .describe("The file name of the attachment to search through."),
        query: z
          .string()
          .describe(
            "The search query or keywords to look for in the file content."
          ),
        limit: z
          .number()
          .optional()
          .describe(
            "Maximum number of relevant chunks to return (default: 5, max: 10)."
          ),
      }),
      execute: async ({ fileName, query, limit = 5 }) => {
        console.log(`🚀 [ArtifactService] search_file_content tool called`);
        console.log(`📋 [ArtifactService] Parameters:`, {
          fileName,
          query,
          limit,
        });

        try {
          const file = await this.findFileByName(fileName);
          if (!file) {
            console.log(`❌ [ArtifactService] Tool result: File not found`);
            return {
              success: false,
              message: `File '${fileName}' not found in this conversation.`,
            };
          }

          const maxLimit = Math.min(limit, 10); // Cap at 10 results
          console.log(`🔢 [ArtifactService] Using search limit: ${maxLimit}`);

          const result = await this.searchFileContent(file, query, maxLimit);

          if (result.matches === 0) {
            console.log(`❌ [ArtifactService] Tool result: No matches found`);
            return {
              success: false,
              message: `No content found matching "${query}" in file '${fileName}'.`,
              fileName: file.name,
              query: query,
              matches: 0,
            };
          }

          console.log(
            `✅ [ArtifactService] Tool result: Found ${result.matches} matches`
          );
          console.log(`📊 [ArtifactService] Search result stats:`, {
            matches: result.matches,
            contentLength: result.content.length,
            query: query,
          });

          return {
            success: true,
            message: `Found ${result.matches} relevant chunks matching "${query}" in '${fileName}'.`,
            fileName: file.name,
            mimeType: file.mimeType,
            query: query,
            matches: result.matches,
            content: result.content,
          };
        } catch (error) {
          console.error(`❌ [ArtifactService] Tool error:`, error);
          return {
            success: false,
            message: `Error searching file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
    });
  }

  /**
   * Gets all the artifact management tools associated with this service instance,
   * mapped by tool name.
   * @returns An object where keys are tool names and values are Tool objects.
   */
  public getTools(): Record<string, Tool> {
    return {
      load_file_content: this.loadArtifactTool(),
      search_file_content: this.searchFileContentTool(),
      create_artifact: this.createArtifactTool(),
    };
  }
}
