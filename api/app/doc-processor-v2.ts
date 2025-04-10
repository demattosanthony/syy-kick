import os from "os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  mistralAi,
  MODELS,
  smallOpenaiEmbeddingModel,
} from "./features/models";
import s3 from "./config/s3";
import { markitdownFileExtensions } from "./config/mime-types";
import { embedMany, generateText } from "ai";
import { sanitizeText } from "./doc-processor";
import { rm } from "node:fs/promises";
import { documentEmbeddings } from "./config/schema";
import db from "./config/db";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

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
  private readonly debug: boolean;
  private readonly debugDir?: string;

  constructor(
    fileKey: string,
    fileName: string,
    mimeType: string,
    documentId?: string,
    debug: boolean = false
  ) {
    this.fileKey = fileKey;
    this.fileName = fileName;
    this.mimeType = mimeType;
    this.documentId = documentId;
    this.fileExtension = "." + (fileName.split(".").pop()?.toLowerCase() || "");
    this.debug = debug;

    if (this.debug) {
      // Create a unique directory name for this run
      const timestamp = Date.now();
      const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_"); // Sanitize filename
      // Use a relative path instead of os.tmpdir()
      this.debugDir = path.join(
        "./debug_output",
        `doc-processor-debug-${safeFileName}-${timestamp}`
      );
      console.log(
        `Debugging enabled. Output will be saved to: ${this.debugDir}`
      );
    }
  }

  // --- Debug Helper ---

  /**
   * Writes content to a file within the debug directory.
   * Creates the directory if it doesn't exist.
   */
  private async _writeDebugFile(
    filePath: string,
    content: string | Buffer
  ): Promise<void> {
    if (!this.debug || !this.debugDir) {
      return;
    }
    try {
      const fullPath = path.join(this.debugDir, filePath);
      const dir = path.dirname(fullPath);
      // Create directory recursively if it doesn't exist
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content);
      // console.log(`Debug file written: ${fullPath}`); // Optional: log each write
    } catch (error) {
      console.error(`Failed to write debug file ${filePath}:`, error);
    }
  }

  // --- Public API Methods ---

  /**
   * Processes the file and returns the cleaned markdown content.
   */
  public async getMarkdown(): Promise<string> {
    const { rawMarkdown, images } = await this._getRawData();
    // Raw data debug writing moved to _getRawData
    const cleanedMarkdown = this._cleanMarkdown(rawMarkdown, images);
    await this._writeDebugFile("2_cleaned_markdown.md", cleanedMarkdown);
    return cleanedMarkdown;
  }

  /**
   * Processes the file, generates cleaned markdown, segments it,
   * generates embeddings (placeholder), and saves them (placeholder).
   */
  public async processAndEmbed(): Promise<object> {
    console.log(`Processing and embedding ${this.fileName}`);
    if (this.debug && this.debugDir) {
      // Clear any previous debug dir for the same file run if needed (optional)
      // await rm(this.debugDir, { recursive: true, force: true }).catch(() => {});
      console.log(`Initializing debug directory: ${this.debugDir}`);
      await this._ensureDebugDir(); // Ensure base debug dir exists
    }

    const markdown = await this.getMarkdown(); // This will call _getRawData and _cleanMarkdown, writing their debug files
    console.log(`Markdown length: ${markdown.length}`);

    const chunks = await this._segmentMarkdown(markdown);
    console.log(`Segmented into ${chunks.length} chunks`);
    if (this.debug) {
      for (let i = 0; i < chunks.length; i++) {
        await this._writeDebugFile(
          path.join("3_chunks", `chunk_${i}.txt`),
          chunks[i]
        );
      }
      await this._writeDebugFile(
        "3_chunks_manifest.json",
        JSON.stringify({ count: chunks.length }, null, 2)
      );
    }

    const embeddings = await this._generateEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings`);

    const saveResult = await this._saveEmbeddings(embeddings, chunks);

    // Clean up any temporary image files created during PDF processing *unless* debugging
    await this._cleanupTempImages();

    return {
      markdownLength: markdown.length,
      chunkCount: chunks.length,
      embeddingCount: embeddings.length,
      saveResult,
      debugPath: this.debug ? this.debugDir : undefined,
    };
  }

  // --- Internal Helper Methods ---

  private async _ensureDebugDir(): Promise<void> {
    if (this.debug && this.debugDir) {
      try {
        await mkdir(this.debugDir, { recursive: true });
      } catch (error) {
        console.error(
          `Failed to create debug directory ${this.debugDir}:`,
          error
        );
      }
    }
  }

  private async getFile(): Promise<Buffer> {
    const file = await s3.file(this.fileKey).arrayBuffer();
    return Buffer.from(file);
  }

  /**
   * Fetches the file and extracts raw data based on the file type.
   */
  private async _getRawData(): Promise<ExtractedData> {
    await this._ensureDebugDir(); // Ensure debug dir exists before potential writes
    const file = await this.getFile();
    const base64 = file.toString("base64"); // Common case

    let result: ExtractedData;

    if (this.mimeType.startsWith("image/")) {
      const markdown = await this._processImage(base64, this.mimeType);
      result = { rawMarkdown: markdown, images: [] };
    } else if (this.fileExtension === ".pdf") {
      result = await this._processPdf(base64);
    } else if (markitdownFileExtensions.includes(this.fileExtension)) {
      const markdown = await this._processWithMarkitdown(file);
      result = { rawMarkdown: markdown, images: [] };
    } else {
      console.warn(
        `Unsupported file type: ${this.mimeType} / ${this.fileExtension}`
      );
      result = { rawMarkdown: "", images: [] }; // Handle unsupported types gracefully
    }

    // Save raw data for debugging *after* processing attempt
    if (this.debug) {
      // Use a distinct name for the raw markdown from initial extraction step
      await this._writeDebugFile(
        "1_raw_extraction_markdown.md",
        result.rawMarkdown
      );
      if (result.images.length > 0) {
        await this._writeDebugFile(
          "1_extracted_images_manifest.json",
          JSON.stringify(
            result.images.map((img) => ({
              id: img.id,
              fileName: img.fileName,
              mimeType: img.mimeType,
              description: img.description,
            })),
            null,
            2
          )
        );
        // Images themselves are saved during _processPdf if debugging
      }
    }

    return result;
  }

  /**
   * Extracts raw markdown from Markitdown compatible files.
   */
  private async _processWithMarkitdown(file: Buffer): Promise<string> {
    // Decide on temp file location based on debug flag
    const tempFileName = `${Date.now()}-${this.fileName}`;
    const tempBaseDir =
      this.debug && this.debugDir
        ? path.join(this.debugDir, "temp_files")
        : "/tmp";
    const tempFile = path.join(tempBaseDir, tempFileName);

    // Ensure the directory exists (especially for debug)
    if (this.debug && this.debugDir) {
      await mkdir(path.dirname(tempFile), { recursive: true }).catch(
        console.error
      );
    }

    await Bun.write(tempFile, file);
    const expandedPath = tempFile.replace(/^~(?=$|\/|\\)/, os.homedir());

    try {
      const proc = Bun.spawn(["markitdown", expandedPath]);
      const markdown = await new Response(proc.stdout).text();
      await this._writeDebugFile("markitdown_output.md", markdown); // Debug output
      return markdown;
    } catch (error) {
      console.error("Error processing with markitdown:", error);
      await this._writeDebugFile(
        "markitdown_error.log",
        error instanceof Error ? error.message : String(error)
      );
      return ""; // Return empty string on error
    } finally {
      // Clean up temp file only if *not* debugging
      if (!this.debug) {
        try {
          // Use Bun.file with the original tempFile path
          const fileHandle = Bun.file(tempFile);
          if (await fileHandle.exists()) {
            await rm(tempFile, { force: true }); // Use rm from fs/promises
          }
        } catch (cleanupError) {
          console.warn(`Failed to delete temp file ${tempFile}:`, cleanupError);
        }
      } else {
        console.log(`Debug mode: Preserving temp file: ${tempFile}`);
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
      await this._writeDebugFile("image_description.md", text);
      return text;
    } catch (error) {
      console.error("Error processing image:", error);
      await this._writeDebugFile(
        "image_description_error.log",
        error instanceof Error ? error.message : String(error)
      );
      return ""; // Return empty string on error
    }
  }

  /**
   * Extracts raw markdown and image data from a PDF using OCR.
   */
  private async _processPdf(base64: string): Promise<ExtractedData> {
    // TODO: if there is more pages than are allowed by the API, we need to split the file into chunks
    await this._ensureDebugDir(); // Ensure debug dir exists for saving images
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
      let imageIndex = 0; // For unique naming in debug dir

      for (const item of result.pages) {
        if (item.markdown) {
          markdown += item.markdown + "\n\n";
        }

        for (const image of item.images) {
          if (!image.imageBase64) {
            continue;
          }

          let imageBase64Data = image.imageBase64;
          if (imageBase64Data.includes(",")) {
            imageBase64Data = imageBase64Data.split(",", 2)[1];
          }

          const imageBuffer = Buffer.from(imageBase64Data, "base64");
          // Assume jpeg, but try to get extension if possible (though OCR likely won't provide it)
          const imageMimeType = "image/jpeg"; // Or infer if possible
          const imageFileExt = ".jpg"; // Match assumed mime type
          const imageFileName = `extracted_image_${imageIndex++}${imageFileExt}`;

          // Save image to debug directory if debugging is enabled
          if (this.debug && this.debugDir) {
            const debugImageSubDir = "images"; // Define subdirectory for images
            const debugImagePath = path.join(debugImageSubDir, imageFileName); // Path relative to debugDir
            await this._writeDebugFile(debugImagePath, imageBuffer); // Use helper with relative path
            images.push({
              id: image.id, // Use the ID provided by the OCR
              url: `debug://${debugImageSubDir}/${imageFileName}`, // Point to the debug file path (relative)
              fileName: imageFileName, // Store the debug filename
              mimeType: imageMimeType,
              // Optionally generate description here if needed for manifest
            });
          } else {
            // If not debugging, we don't need to store image data locally
            // Just record minimal info if needed downstream, but URL/fileName become less relevant
            images.push({
              id: image.id,
              url: `data:${imageMimeType};base64,...`, // Indicate data was present but not stored
              fileName: `image_${image.id}`, // Placeholder name
              mimeType: imageMimeType,
            });
          }
        }
      }
      // Write the combined markdown from all pages
      await this._writeDebugFile("pdf_ocr_combined_raw_markdown.md", markdown);
      return { rawMarkdown: markdown, images };
    } catch (error) {
      console.error("Error processing PDF:", error);
      await this._writeDebugFile(
        "pdf_ocr_error.log",
        error instanceof Error ? error.message : String(error)
      );
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
        // or the debug path URI we created
        if (isImageLine) {
          const imageSourceMatch = line.match(/\((.*?)\s*(".*")?\s*\)$/);
          if (imageSourceMatch && imageSourceMatch[1]) {
            const source = imageSourceMatch[1];
            if (images.some((img) => source === img.id || source === img.url)) {
              // Check against ID or debug URL
              return false; // It's a markdown link pointing to an extracted image ID or debug file, remove it
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
   * Segments markdown text into chunks by first splitting the text into payloads
   * respecting Jina API limits, then calling the Jina API for each payload.
   */
  private async _segmentMarkdown(markdown: string): Promise<string[]> {
    if (!markdown.trim()) {
      return []; // Return empty array if markdown is empty
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1200,
      chunkOverlap: 200,
    });
    const segments = await textSplitter.splitText(markdown);

    console.log(`Total segments received from Jina: ${segments.length}`);
    return segments;
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
    // Define subdirectory for embedding related debug files
    const embeddingsDebugSubDir = "embeddings";

    if (!this.documentId) {
      const errorMsg = "Document ID is missing, cannot save embeddings.";
      // If debugging, log this error instead of throwing? Or allow proceeding without saving?
      if (this.debug) {
        console.error(errorMsg + " Continuing in debug mode.");
        await this._writeDebugFile(
          path.join(embeddingsDebugSubDir, "save_error.log"),
          errorMsg
        );
        return { count: 0, error: "Missing documentId" };
      }
      throw new Error(errorMsg);
    }
    if (embeddings.length !== chunks.length) {
      const errorMsg = `Mismatch between embeddings count (${embeddings.length}) and chunks count (${chunks.length})`;
      await this._writeDebugFile(
        path.join(embeddingsDebugSubDir, "save_error.log"),
        errorMsg
      );
      throw new Error(errorMsg);
    }

    try {
      const valuesToInsert = embeddings.map((embedding, index) => ({
        documentId: this.documentId as string, // Cast safe due to check above (unless debugging)
        text: chunks[index],
        embedding: embedding,
        metadata: null, // Add metadata if available/needed
      }));

      // Write the data intended for DB insertion to a debug file
      await this._writeDebugFile(
        path.join(embeddingsDebugSubDir, "values_to_insert.json"),
        JSON.stringify(valuesToInsert, null, 2)
      );

      const result = await db
        .insert(documentEmbeddings)
        .values(valuesToInsert)
        .returning({ count: documentEmbeddings.id }); // Modify if drizzle needs different return syntax

      await this._writeDebugFile(
        path.join(embeddingsDebugSubDir, "save_success.json"),
        JSON.stringify({ savedCount: result.length }, null, 2)
      );
      return { count: result.length };
    } catch (error) {
      console.error("Error saving embeddings to DB:", error);
      await this._writeDebugFile(
        path.join(embeddingsDebugSubDir, "save_db_error.log"),
        error instanceof Error
          ? error.message + (error.stack ? "\\n" + error.stack : "")
          : String(error)
      );
      if (this.debug) {
        return { count: 0, error: "DB insert failed" };
      }
      throw error; // Re-throw if not debugging
    }
  }

  /**
   * Cleans up temporary image files created during PDF processing.
   */
  private async _cleanupTempImages(): Promise<void> {
    if (this.debug) {
      console.log("Debug mode: Skipping cleanup of temporary files/images.");
      return;
    }

    // Previous logic tried cleaning './temp_img_*'. This was potentially incorrect
    // as _processPdf didn't save them unless debugging, and markitdown cleans its own file.
    // So, in non-debug mode, there might be nothing standard to clean here anymore.
    // If other processes *do* create temp files in a known location (like /tmp),
    // cleanup logic for those could be added here.

    console.log(
      "Cleanup: No standard temporary files to remove in non-debug mode (markitdown handles its own)."
    );
  }
}
