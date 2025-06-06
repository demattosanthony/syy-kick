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

export type PageImage = {
  name: string;
  imagePath: string;
  base64Data?: string;
  mimeType: string;
};

export type FileContentResult = {
  content: string;
  totalPages: number;
  totalChunks: number;
  pageInfo?: string;
  images?: PageImage[];
};

export type SearchResult = {
  content: string;
  matches: number;
  images?: PageImage[];
};

export class ArtifactService {
  constructor(private threadId: string) {}

  private normalizeFilename(filename: string): string {
    // Replace various whitespace characters (including narrow no-break space \u202f,
    // tabs, multiple spaces) with a single standard space. Also, trim leading/trailing whitespace.
    return filename.replace(/[\s\u202f]+/g, " ").trim();
  }

  /**
   * Load images for given page IDs
   */
  private async loadImagesForPages(
    pageIds: (string | null)[]
  ): Promise<PageImage[]> {
    // Filter out null values and ensure we have valid page IDs
    const validPageIds = pageIds.filter((id): id is string => id !== null);

    if (validPageIds.length === 0) return [];

    console.log(
      `🖼️ [ArtifactService] Loading images for ${validPageIds.length} pages`
    );

    const images = await db.query.filePageImages.findMany({
      where: (images, { inArray }) => inArray(images.filePageId, validPageIds),
    });

    if (images.length === 0) {
      console.log(
        `📷 [ArtifactService] No images found for the selected pages`
      );
      return [];
    }

    console.log(
      `🖼️ [ArtifactService] Found ${images.length} images, loading from S3...`
    );

    const imageResults: PageImage[] = [];

    for (const image of images) {
      try {
        // Load image data from S3
        const file = s3.file(image.imagePath);
        if (await file.exists()) {
          const imageBuffer = await file.arrayBuffer();
          const base64Data = Buffer.from(imageBuffer).toString("base64");

          imageResults.push({
            name: image.name ?? "image",
            imagePath: image.imagePath,
            base64Data: base64Data,
            mimeType: "image/png", // Most PDF conversions are PNG
          });

          console.log(
            `✅ [ArtifactService] Loaded image: ${image.name} (${imageBuffer.byteLength} bytes)`
          );
        } else {
          console.warn(
            `⚠️ [ArtifactService] Image not found in S3: ${image.imagePath}`
          );
        }
      } catch (error) {
        console.error(
          `❌ [ArtifactService] Error loading image ${image.name}:`,
          error
        );
      }
    }

    console.log(
      `🖼️ [ArtifactService] Successfully loaded ${imageResults.length}/${images.length} images`
    );
    return imageResults;
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
   * Get paginated content from a file with images
   */
  private async getFileContent(
    file: any,
    startPage?: number,
    endPage?: number,
    startChunk?: number,
    endChunk?: number,
    includeImages: boolean = true
  ): Promise<FileContentResult> {
    console.log(
      `📖 [ArtifactService] Loading content from file: "${file.name}" (${file.mimeType})`
    );
    console.log(
      `📊 [ArtifactService] Pagination params - startPage: ${startPage}, endPage: ${endPage}, startChunk: ${startChunk}, endChunk: ${endChunk}, includeImages: ${includeImages}`
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
        images: [],
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

    let selectedPageIds: string[] = [];
    let content = "";
    let pageInfo = "";

    // Handle PDF-style pagination (by pages)
    if (
      file.mimeType === "application/pdf" &&
      (startPage !== undefined || endPage !== undefined)
    ) {
      console.log(`🔖 [ArtifactService] Using PDF page-based pagination`);
      const start = Math.max((startPage || 1) - 1, 0); // Convert to 0-based
      // If endPage is not provided, default to showing only the startPage
      const defaultEndPage = startPage !== undefined ? startPage : totalPages;
      const end = Math.min((endPage || defaultEndPage) - 1, totalPages - 1);

      console.log(
        `📖 [ArtifactService] Loading pages ${start + 1} to ${end + 1}`
      );

      const selectedPages = pages.slice(start, end + 1);
      selectedPageIds = selectedPages.map((page) => page.id);

      content = selectedPages
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

      pageInfo = `Pages ${start + 1}-${end + 1} of ${totalPages}`;
      console.log(
        `✅ [ArtifactService] Returned ${selectedPages.length} pages (${content.length} chars)`
      );
    }
    // Handle chunk-based pagination (for non-PDF files or when chunk range is specified)
    else if (startChunk !== undefined || endChunk !== undefined) {
      console.log(`🧩 [ArtifactService] Using chunk-based pagination`);
      const allChunks = pages.flatMap((page) =>
        page.chunks.map((chunk) => ({
          ...chunk,
          pageNumber: page.pageNumber,
          pageId: page.id,
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
      selectedPageIds = [
        ...new Set(selectedChunks.map((chunk) => chunk.pageId)),
      ];

      content = selectedChunks
        .map((chunk, index) => {
          const chunkNum = start + index + 1;
          console.log(
            `🧩 [ArtifactService] Chunk ${chunkNum} (Page ${chunk.pageNumber}): ${chunk.content.length} chars`
          );
          return `=== Chunk ${chunkNum} (Page ${chunk.pageNumber}) ===\n${chunk.content}`;
        })
        .join("\n\n");

      pageInfo = `Chunks ${start + 1}-${end + 1} of ${totalChunks}`;
      console.log(
        `✅ [ArtifactService] Returned ${selectedChunks.length} chunks (${content.length} chars)`
      );
    }
    // Default: return first page or first few chunks
    else if (file.mimeType === "application/pdf") {
      console.log(
        `📖 [ArtifactService] Using default PDF mode - returning first page`
      );
      const firstPage = pages[0];
      selectedPageIds = [firstPage.id];
      content = `=== Page 1 ===\n${firstPage.chunks.map((chunk) => chunk.content).join("\n")}`;
      pageInfo = `Page 1 of ${totalPages}`;
      console.log(
        `✅ [ArtifactService] Returned page 1 (${content.length} chars)`
      );
    } else {
      console.log(
        `🧩 [ArtifactService] Using default non-PDF mode - returning first 3 chunks`
      );
      const allChunks = pages.flatMap((page) =>
        page.chunks.map((chunk) => ({ ...chunk, pageId: page.id }))
      );
      const firstFewChunks = allChunks.slice(0, 3); // Show first 3 chunks by default
      selectedPageIds = [
        ...new Set(firstFewChunks.map((chunk) => chunk.pageId)),
      ];

      content = firstFewChunks
        .map((chunk, index) => {
          return `=== Chunk ${index + 1} ===\n${chunk.content}`;
        })
        .join("\n\n");
      pageInfo = `Chunks 1-${firstFewChunks.length} of ${totalChunks}`;
      console.log(
        `✅ [ArtifactService] Returned ${firstFewChunks.length} chunks (${content.length} chars)`
      );
    }

    // Load images for the selected pages if requested
    let images: PageImage[] = [];
    if (includeImages && selectedPageIds.length > 0) {
      images = await this.loadImagesForPages(selectedPageIds);
    }

    return { content, totalPages, totalChunks, pageInfo, images };
  }

  /**
   * Search through file content and return relevant chunks with images
   */
  private async searchFileContent(
    file: any,
    query: string,
    limit: number = 5,
    includeImages: boolean = true
  ): Promise<SearchResult> {
    console.log(
      `🔍 [ArtifactService] Searching file "${file.name}" for: "${query}" (limit: ${limit}, includeImages: ${includeImages})`
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
      return {
        content: "No content found for this file.",
        matches: 0,
        images: [],
      };
    }

    // Flatten all chunks and prepare for reranking
    const allChunks = pages.flatMap((page) =>
      page.chunks.map((chunk) => ({
        ...chunk,
        pageNumber: page.pageNumber,
        pageId: page.id,
      }))
    );

    console.log(
      `📊 [ArtifactService] Searching through ${allChunks.length} chunks across ${pages.length} pages`
    );

    if (allChunks.length === 0) {
      console.log(`⚠️ [ArtifactService] No chunks found for reranking`);
      return {
        content: `No content found matching "${query}".`,
        matches: 0,
        images: [],
      };
    }

    // Prepare chunks for reranking
    const chunkTexts = allChunks.map((chunk) => chunk.content);
    const maxLimit = Math.min(limit, 10); // Cap at 10 results

    console.log(
      `🤖 [ArtifactService] Using Jina AI reranker with topN: ${maxLimit}`
    );

    let rankedChunks: any[] = [];
    let selectedPageIds: string[] = [];

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
        return {
          content: `No content found matching "${query}".`,
          matches: 0,
          images: [],
        };
      }

      console.log(
        `✅ [ArtifactService] Reranker returned ${rerankedResults.results.length} results`
      );

      // Map reranker results back to original chunks with metadata
      rankedChunks = rerankedResults.results
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
        return {
          content: `No content found matching "${query}".`,
          matches: 0,
          images: [],
        };
      }

      selectedPageIds = [...new Set(rankedChunks.map((chunk) => chunk.pageId))];
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
      rankedChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      if (rankedChunks.length === 0) {
        console.log(
          `❌ [ArtifactService] No matches found with fallback search for query "${query}"`
        );
        return {
          content: `No content found matching "${query}".`,
          matches: 0,
          images: [],
        };
      }

      selectedPageIds = [...new Set(rankedChunks.map((chunk) => chunk.pageId))];
    }

    console.log(
      `✅ [ArtifactService] Search returned ${rankedChunks.length} matches`
    );

    const content = rankedChunks
      .map((chunk, index) => {
        return `=== Match ${index + 1} (Page ${chunk.pageNumber}, Score: ${chunk.score.toFixed(3)}) ===\n${chunk.content}`;
      })
      .join("\n\n");

    // Load images for the matching pages if requested
    let images: PageImage[] = [];
    if (includeImages && selectedPageIds.length > 0) {
      images = await this.loadImagesForPages(selectedPageIds);
    }

    return { content, matches: rankedChunks.length, images };
  }

  private loadArtifactTool(): Tool {
    return tool({
      description:
        "Loads content from a file attachment with pagination support. This tool allows you to access processed file content in manageable chunks. For PDF files, you can specify page ranges. For other files, you can specify chunk ranges. Use this to read through large documents systematically. Can also return images of the pages when available. IMPORTANT: This is the PRIMARY tool to use for engineering drawings and files categorized as 'drawing' since they are stored as high-resolution images rather than searchable text. For drawing files, use page-based pagination to navigate through drawing sheets and examine specific details.",
      parameters: z.object({
        fileName: z
          .string()
          .describe("The file name of the attachment to load."),
        startPage: z
          .number()
          .optional()
          .describe(
            "For PDF files and drawings: starting page number (1-based). If not specified, shows first page. Essential for navigating through drawing sets."
          ),
        endPage: z
          .number()
          .optional()
          .describe(
            "For PDF files and drawings: ending page number (1-based). If not specified, shows only start page. Use for examining multiple drawing sheets at once."
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
        includeImages: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Whether to include page images in the response when available. Critical for drawing files where visual content is the primary information."
          ),
      }),
      execute: async ({
        fileName,
        startPage,
        endPage,
        startChunk,
        endChunk,
        includeImages = true,
      }) => {
        console.log(`🚀 [ArtifactService] load_file_content tool called`);
        console.log(`📋 [ArtifactService] Parameters:`, {
          fileName,
          startPage,
          endPage,
          startChunk,
          endChunk,
          includeImages,
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
            endChunk,
            includeImages
          );

          console.log(
            `✅ [ArtifactService] Tool result: Successfully loaded content`
          );
          console.log(`📊 [ArtifactService] Result stats:`, {
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
            contentLength: result.content.length,
            imagesCount: result.images?.length || 0,
          });

          return {
            success: true,
            message: `Successfully loaded content from '${fileName}' (${result.pageInfo})${result.images?.length ? ` with ${result.images.length} images` : ""}.`,
            fileName: file.name,
            mimeType: file.mimeType,
            content: result.content,
            totalPages: result.totalPages,
            totalChunks: result.totalChunks,
            pageInfo: result.pageInfo,
            images: result.images,
          };
        } catch (error) {
          console.error(`❌ [ArtifactService] Tool error:`, error);
          return {
            success: false,
            message: `Error loading file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
      // Multi-modal support for Anthropic models
      experimental_toToolResultContent(result) {
        if (typeof result === "string") {
          return [{ type: "text", text: result }];
        }

        const content: any[] = [];

        // Add text content
        if (result.content) {
          content.push({ type: "text", text: result.content });
        }

        // Add images if available and model supports it
        if (result.images && Array.isArray(result.images)) {
          for (const image of result.images) {
            if (image.base64Data) {
              content.push({
                type: "image",
                data: image.base64Data,
                mimeType: image.mimeType,
              });
            }
          }
        }

        return content.length > 0
          ? content
          : [{ type: "text", text: JSON.stringify(result) }];
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
        "Searches through the content of a file attachment to find relevant information. This tool performs semantic search through the processed content and returns the most relevant chunks with their associated images when available. Use this when you need to find specific information within a large document. NOTE: This tool is designed for text-based documents and will NOT work effectively for engineering drawings or files categorized as 'drawing' since they contain primarily visual/graphical information stored as images. For drawing files, use the load_file_content tool instead to paginate through and view specific pages.",
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
        includeImages: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Whether to include page images in the response when available (useful for visual context)."
          ),
      }),
      execute: async ({ fileName, query, limit = 5, includeImages = true }) => {
        console.log(`🚀 [ArtifactService] search_file_content tool called`);
        console.log(`📋 [ArtifactService] Parameters:`, {
          fileName,
          query,
          limit,
          includeImages,
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

          const result = await this.searchFileContent(
            file,
            query,
            maxLimit,
            includeImages
          );

          if (result.matches === 0) {
            console.log(`❌ [ArtifactService] Tool result: No matches found`);
            return {
              success: false,
              message: `No content found matching "${query}" in file '${fileName}'.`,
              fileName: file.name,
              query: query,
              matches: 0,
              images: [],
            };
          }

          console.log(
            `✅ [ArtifactService] Tool result: Found ${result.matches} matches`
          );
          console.log(`📊 [ArtifactService] Search result stats:`, {
            matches: result.matches,
            contentLength: result.content.length,
            imagesCount: result.images?.length || 0,
            query: query,
          });

          return {
            success: true,
            message: `Found ${result.matches} relevant chunks matching "${query}" in '${fileName}'${result.images?.length ? ` with ${result.images.length} images` : ""}.`,
            fileName: file.name,
            mimeType: file.mimeType,
            query: query,
            matches: result.matches,
            content: result.content,
            images: result.images,
          };
        } catch (error) {
          console.error(`❌ [ArtifactService] Tool error:`, error);
          return {
            success: false,
            message: `Error searching file content: ${error instanceof Error ? error.message : "Unknown error"}`,
          };
        }
      },
      // Multi-modal support for Anthropic models
      experimental_toToolResultContent(result) {
        if (typeof result === "string") {
          return [{ type: "text", text: result }];
        }

        const content: any[] = [];

        // Add text content
        if (result.content) {
          content.push({ type: "text", text: result.content });
        }

        // Add images if available and model supports it
        if (result.images && Array.isArray(result.images)) {
          for (const image of result.images) {
            if (image.base64Data) {
              content.push({
                type: "image",
                data: image.base64Data,
                mimeType: image.mimeType,
              });
            }
          }
        }

        return content.length > 0
          ? content
          : [{ type: "text", text: JSON.stringify(result) }];
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
