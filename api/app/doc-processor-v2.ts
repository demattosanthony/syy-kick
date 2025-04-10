import os from "os";
import {
  mistralAi,
  MODELS,
  smallOpenaiEmbeddingModel,
} from "./features/models";
import s3 from "./config/s3";
import { markitdownFileExtensions } from "./config/mime-types";
import { embedMany, generateText } from "ai";
import { fetch } from "bun";
import { sanitizeText } from "./doc-processor";
import { readdir } from "node:fs/promises";
import { documentEmbeddings } from "./config/schema";
import db from "./config/db";

interface ExtractedData {
  rawMarkdown: string;
  images: {
    id: string;
    url: string;
    fileName: string;
    mimeType: string;
    description?: string;
  }[];
}

export class DocumentProcessor {
  private readonly fileKey: string;
  private readonly fileName: string;
  private readonly mimeType: string;
  private readonly documentId?: string;
  private readonly fileExtension: string;

  // Jina Segmentation API has a payload limit of 64k characters
  private readonly JINA_PAYLOAD_LIMIT = 64_000;

  constructor(
    fileKey: string,
    fileName: string,
    mimeType: string,
    documentId?: string
  ) {
    this.fileKey = fileKey;
    this.fileName = fileName;
    this.mimeType = mimeType;
    this.documentId = documentId;
    this.fileExtension = "." + (fileName.split(".").pop()?.toLowerCase() || "");
  }

  // --- Public API Methods ---

  /**
   * Processes the file and returns the cleaned markdown content.
   */
  public async getMarkdown(): Promise<string> {
    const { rawMarkdown, images } = await this._getRawData();
    const cleanedMarkdown = this._cleanMarkdown(rawMarkdown, images);
    return cleanedMarkdown;
  }

  /**
   * Processes the file, generates cleaned markdown, segments it,
   * generates embeddings (placeholder), and saves them (placeholder).
   */
  public async processAndEmbed(): Promise<object> {
    const markdown = await this.getMarkdown();
    console.log(`Markdown length: ${markdown.length}`);
    const chunks = await this._segmentMarkdown(markdown);
    console.log(`Segmented into ${chunks.length} chunks`);
    const embeddings = await this._generateEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);
    const saveResult = await this._saveEmbeddings(embeddings, chunks);

    // Clean up any temporary image files created during PDF processing
    await this._cleanupTempImages();

    return {
      markdownLength: markdown.length,
      chunks,
      embeddingCount: embeddings.length,
      saveResult,
    };
  }

  // --- Internal Helper Methods ---

  private async getFile(): Promise<Buffer> {
    const file = await s3.file(this.fileKey).arrayBuffer();
    return Buffer.from(file);
  }

  /**
   * Fetches the file and extracts raw data based on the file type.
   */
  private async _getRawData(): Promise<ExtractedData> {
    const file = await this.getFile();
    const base64 = file.toString("base64"); // Common case

    if (this.mimeType.startsWith("image/")) {
      const markdown = await this._processImage(base64, this.mimeType);
      return { rawMarkdown: markdown, images: [] };
    }

    if (this.fileExtension === ".pdf") {
      return this._processPdf(base64);
    }

    if (markitdownFileExtensions.includes(this.fileExtension)) {
      const markdown = await this._processWithMarkitdown(file);
      return { rawMarkdown: markdown, images: [] };
    }

    console.warn(
      `Unsupported file type: ${this.mimeType} / ${this.fileExtension}`
    );
    return { rawMarkdown: "", images: [] }; // Handle unsupported types gracefully
  }

  /**
   * Extracts raw markdown from Markitdown compatible files.
   */
  private async _processWithMarkitdown(file: Buffer): Promise<string> {
    const tempFile = `/tmp/${Date.now()}-${this.fileName}`;
    await Bun.write(tempFile, file);
    const expandedPath = tempFile.replace(/^~(?=$|\/|\\)/, os.homedir());

    try {
      const proc = Bun.spawn(["markitdown", expandedPath]);
      const markdown = await new Response(proc.stdout).text();
      return markdown;
    } catch (error) {
      console.error("Error processing with markitdown:", error);
      return ""; // Return empty string on error
    } finally {
      // Ensure temp file is cleaned up
      try {
        await Bun.file(tempFile).delete();
      } catch (cleanupError) {
        console.warn(`Failed to delete temp file ${tempFile}:`, cleanupError);
      }
    }
  }

  /**
   * Extracts text description from an image.
   */
  private async _processImage(
    base64: string,
    mimeType: string
  ): Promise<string> {
    try {
      const { text } = await generateText({
        model: MODELS["gemini-2.0-flash"].model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a machine learning model trained to analyze images and describe them in detail. You will be given an image and you will need to describe it in detail. The description should be in markdown format. The description should only be around a paragraph or two long. ONLY output the markdown description, nothing else. Do not include any text like 'Here is the description of the image', 'This image is of a ...', or anything like that. Just output the markdown description.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Here is the image, analyze it and describe it in detail. ONLY output the markdown description.",
              },
              {
                image: base64,
                type: "image",
                mimeType: mimeType,
              },
            ],
          },
        ],
      });
      return text;
    } catch (error) {
      console.error("Error processing image:", error);
      return ""; // Return empty string on error
    }
  }

  /**
   * Extracts raw markdown and image data from a PDF using OCR.
   */
  private async _processPdf(base64: string): Promise<ExtractedData> {
    // TODO: if there is more pages than are allowed by the API, we need to split the file into chunks
    try {
      const result = await mistralAi.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          documentUrl: `data:${this.mimeType};base64,${base64}`,
          type: "document_url",
        },
        includeImageBase64: true,
      });

      let markdown = "";
      const images: ExtractedData["images"] = [];

      for (const item of result.pages) {
        if (item.markdown) {
          markdown += item.markdown + "\n\n";
        }

        for (const image of item.images) {
          if (!image.imageBase64) {
            continue;
          }

          let imageBase64 = image.imageBase64;
          if (imageBase64.includes(",")) {
            imageBase64 = imageBase64.split(",", 2)[1];
          }

          // Store image temporarily locally - needed for potential later processing/upload
          // We'll clean these up later in _cleanupTempImages
          //   const imageBuffer = Buffer.from(imageBase64, "base64");
          //   const tempImagePath = `./temp_img_${image.id}`; // Use a prefix for easy cleanup
          //   await Bun.write(tempImagePath, imageBuffer);

          images.push({
            id: image.id, // Use the ID provided by the OCR
            url: `data:image/jpeg;base64,${imageBase64}`, // Keep full data URL if needed elsewhere
            fileName: image.id, // Store the temporary path
            mimeType: "image/jpeg", // Assume jpeg for now, OCR might not provide type
          });
        }
      }
      return { rawMarkdown: markdown, images };
    } catch (error) {
      console.error("Error processing PDF:", error);
      return { rawMarkdown: "", images: [] }; // Return empty data on error
    }
  }

  /**
   * Cleans raw markdown (sanitizes, removes image links).
   */
  private _cleanMarkdown(
    rawMarkdown: string,
    images: ExtractedData["images"]
  ): string {
    // Remove image markdown links (e.g., ![...](...))
    // This is especially important for PDF output where images are handled separately.
    let cleaned = rawMarkdown
      .split("\n")
      .filter((line) => {
        // Regex to match markdown image syntax: ![alt text](source "title")
        const isImageLine = /^!\[.*?\]\((.*?)\s*("(?:.*[^"])")?\s*\)$/.test(
          line.trim()
        );
        // Additionally, check if the source references one of the extracted image IDs
        // This helps avoid removing legitimate links that coincidentally look like image paths
        if (isImageLine) {
          const imageSourceMatch = line.match(/\((.*?)\s*(".*")?\s*\)$/);
          if (imageSourceMatch && imageSourceMatch[1]) {
            const source = imageSourceMatch[1];
            if (images.some((img) => source === img.id)) {
              return false; // It's a markdown link pointing to an extracted image ID, remove it
            }
          }
        }
        return true; // Keep the line if it's not an image link we extracted
      })
      .join("\n");

    // Apply general sanitization
    cleaned = sanitizeText(cleaned);

    return cleaned;
  }

  /**
   * Calls the Jina API to segment a given text content.
   */
  private async _callJinaApi(content: string): Promise<string[]> {
    if (!content.trim()) {
      return [];
    }
    try {
      console.log(`Calling Jina API with payload size: ${content.length}`);
      const response = await fetch("https://api.jina.ai/v1/segment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
        },
        body: JSON.stringify({
          content: content,
          return_tokens: false,
          return_chunks: true,
          max_chunk_length: 1000, // Max length of each *output* segment
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Jina API request failed: ${response.status} ${response.statusText} - ${errorBody}`
        );
      }

      const data = (await response.json()) as { chunks?: string[] };
      console.log(`Jina returned ${data.chunks?.length ?? 0} segments.`);
      return data.chunks || [];
    } catch (error) {
      console.error("Error segmenting markdown with Jina:", error);
      // Fallback: return the input content as one chunk if API fails
      return [content];
    }
  }

  /**
   * Segments markdown text into chunks, respecting Jina API payload limits.
   */
  private async _segmentMarkdown(markdown: string): Promise<string[]> {
    if (!markdown.trim()) {
      return []; // Return empty array if markdown is empty
    }

    const lines = markdown.split("\n");
    const allSegments: string[] = [];
    let currentPayloadLines: string[] = [];
    let currentPayloadLength = 0;

    for (const line of lines) {
      // Calculate length of the line plus a newline char if adding to existing lines
      const lineLength = line.length + (currentPayloadLines.length > 0 ? 1 : 0);

      // Check if adding this line would exceed the JINA_PAYLOAD_LIMIT
      if (currentPayloadLength + lineLength > this.JINA_PAYLOAD_LIMIT) {
        // If there's content in the current payload, send it to Jina
        if (currentPayloadLines.length > 0) {
          const payload = currentPayloadLines.join("\n");
          const segments = await this._callJinaApi(payload);
          allSegments.push(...segments);
        }

        // Start a new payload with the current line
        // Check if the line *itself* is too long (edge case)
        if (line.length > this.JINA_PAYLOAD_LIMIT) {
          console.warn(
            `Single line exceeds Jina payload limit (${line.length} > ${this.JINA_PAYLOAD_LIMIT}). Sending it as a separate request.`
          );
          const segments = await this._callJinaApi(line);
          allSegments.push(...segments);
          // Reset payload trackers as this line was processed separately
          currentPayloadLines = [];
          currentPayloadLength = 0;
        } else {
          // Start new payload normally
          currentPayloadLines = [line];
          currentPayloadLength = line.length; // Length calculation is simple for the first line
        }
      } else {
        // Add the line to the current payload
        currentPayloadLines.push(line);
        currentPayloadLength += lineLength;
      }
    }

    // Process any remaining lines in the last payload
    if (currentPayloadLines.length > 0) {
      const payload = currentPayloadLines.join("\n");
      const segments = await this._callJinaApi(payload);
      allSegments.push(...segments);
    }

    return allSegments;
  }

  /**
   * Generates embeddings for text chunks.
   */
  private async _generateEmbeddings(chunks: string[]): Promise<number[][]> {
    if (chunks.length === 0) {
      return [];
    }
    console.log(`Generating embeddings for ${chunks.length} chunks.`);
    const { embeddings } = await embedMany({
      model: smallOpenaiEmbeddingModel,
      values: chunks,
    });
    return embeddings;
  }

  /**
   * Saves embeddings to a database.
   */
  private async _saveEmbeddings(embeddings: number[][], chunks: string[]) {
    if (embeddings.length === 0) {
      console.log("No embeddings generated, skipping save.");
      return { count: 0 };
    }
    console.log(`Saving ${embeddings.length} embeddings to DB.`);
    if (!this.documentId) {
      throw new Error("Document ID is required to save embeddings");
    }
    if (embeddings.length !== chunks.length) {
      throw new Error(
        `Mismatch between embeddings count (${embeddings.length}) and chunks count (${chunks.length})`
      );
    }

    const result = await db
      .insert(documentEmbeddings)
      .values(
        embeddings.map((embedding, index) => ({
          documentId: this.documentId as string,
          text: chunks[index],
          embedding: embedding,
          metadata: null,
        }))
      )
      .returning({ count: documentEmbeddings.id }); // Modify if drizzle needs different return syntax

    return { count: result.length };
  }

  /**
   * Cleans up temporary image files created during PDF processing.
   */
  private async _cleanupTempImages(): Promise<void> {
    // This assumes temp images were saved with a specific prefix or pattern
    // For now, we look for files starting with 'temp_img_' in the current dir.
    // A more robust solution would use a dedicated temp directory.
    // Since we removed the temp image saving logic in _processPdf, this might not be needed
    // unless other parts create temp files. Keeping it for now.
    try {
      const dirEntries = await readdir("./");
      const tempImageFiles = dirEntries.filter((name: string) =>
        name.startsWith("temp_img_")
      );

      if (tempImageFiles.length === 0) return; // Nothing to clean

      console.log(
        `Cleaning up ${tempImageFiles.length} temporary image files...`
      );
      for (const fileName of tempImageFiles) {
        try {
          await Bun.file(`./${fileName}`).delete();
          // console.log(`Cleaned up temp image: ${fileName}`); // Keep commented out unless debugging
        } catch (error) {
          console.error(`Failed to delete temp image ${fileName}:`, error);
        }
      }
    } catch (readDirError) {
      // Ignore errors like directory not found if './' somehow becomes invalid
      if (
        readDirError instanceof Error &&
        readDirError.message.includes("ENOENT")
      ) {
        console.warn("Directory '.' not found during cleanup, skipping.");
        return;
      }
      console.error(`Failed to read directory for cleanup:`, readDirError);
    }
  }
}
