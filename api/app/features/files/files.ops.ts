import { desc, eq, and, count, or, ilike, sql } from "drizzle-orm";
import db from "../../config/db";
import s3 from "../../config/s3";
import crypto from "crypto";
import {
  files,
  messagesFiles,
  messages,
  filePages,
  filePageChunks,
  filePageImages,
} from "../../config/schema";
import type { GetFilesQuery, PaginatedFiles, File } from "./files.schemas";
import { processFile } from "./files.processor.";

export async function getFilesForUser(
  userId: string,
  query: GetFilesQuery
): Promise<PaginatedFiles> {
  const { page, limit, search, type, category, file_origin_type } = query;
  const offset = (page - 1) * limit;

  // Build the base where conditions
  const baseConditions = [eq(messages.userId, userId)];
  if (type) {
    baseConditions.push(eq(files.type, type));
  }
  if (category) {
    baseConditions.push(eq(files.category, category));
  }
  if (file_origin_type) {
    baseConditions.push(eq(files.file_origin_type, file_origin_type));
  }
  if (search) {
    baseConditions.push(ilike(files.name, `%${search}%`));
  }

  // Simplified query - no complex joins, just search by file name
  const filesQuery = db
    .selectDistinct({
      id: files.id,
      name: files.name,
      mimeType: files.mimeType,
      size: files.size,
      type: files.type,
      fileHash: files.fileHash,
      syyclops_path: files.syyclops_path,
      sharepoint_path: files.sharepoint_path,
      google_drive_path: files.google_drive_path,
      file_origin_type: files.file_origin_type,
      category: files.category,
      createdAt: files.createdAt,
      updatedAt: files.updatedAt,
    })
    .from(files)
    .innerJoin(messagesFiles, eq(files.id, messagesFiles.fileId))
    .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
    .where(and(...baseConditions))
    .orderBy(desc(files.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count of distinct files
  const totalQuery = db
    .select({ count: sql<number>`count(distinct ${files.id})` })
    .from(files)
    .innerJoin(messagesFiles, eq(files.id, messagesFiles.fileId))
    .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
    .where(and(...baseConditions));

  const [filesResult, totalResult] = await Promise.all([
    filesQuery,
    totalQuery,
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  // Generate presigned URLs for Syyclops files
  const filesWithUrls = await Promise.all(
    filesResult.map(async (file) => {
      if (file.file_origin_type === "syyclops" && file.syyclops_path) {
        try {
          const presignedUrl = s3.file(file.syyclops_path).presign({
            expiresIn: 3600, // 1 hour expiration
            method: "GET",
          });
          return { ...file, url: presignedUrl };
        } catch (error) {
          console.error(
            `Failed to generate presigned URL for file ${file.id}:`,
            error
          );
          return { ...file, url: undefined };
        }
      }
      return { ...file, url: undefined };
    })
  );

  console.log("filesWithUrls", filesWithUrls);

  return {
    files: filesWithUrls as File[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export async function generatePresignedUrl(
  fileName: string,
  mimeType: string,
  size: number
): Promise<{
  fileKey: string;
  uploadUrl: string;
  viewUrl: string;
}> {
  // Generate unique file key for S3
  const fileExtension = fileName.split(".").pop();
  const uniqueFileName = `${crypto.randomUUID()}-${Date.now()}.${fileExtension}`;
  const fileKey = `user-attachments/${uniqueFileName}`;

  console.log(
    `🔗 [GeneratePresignedUrl] Generating presigned URL for: ${fileName} -> ${fileKey}`
  );

  // Generate presigned URL for upload
  const uploadUrl = s3.presign(fileKey, {
    expiresIn: 3600, // 1 hour
    type: mimeType,
    method: "PUT",
  });

  // Generate presigned URL for viewing
  const viewUrl = s3.file(fileKey).presign({
    expiresIn: 3600,
    method: "GET",
    type: mimeType,
  });

  return {
    fileKey,
    uploadUrl,
    viewUrl,
  };
}

export async function createFileRecordAndProcess(
  userId: string,
  fileData: {
    fileName: string;
    mimeType: string;
    size: number;
    fileKey: string;
  }
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  fileKey: string;
  url: string;
  category?: "drawing" | "document";
  isExisting: boolean;
}> {
  const { fileName, mimeType, size, fileKey } = fileData;

  console.log(
    `📄 [CreateFileRecord] Processing file: ${fileName} (${mimeType})`
  );
  console.log(`📊 [CreateFileRecord] File size: ${size} bytes`);

  // Download file from S3 to calculate hash and process content
  let fileBuffer: Buffer;
  try {
    console.log(`⬇️ [CreateFileRecord] Downloading file from S3: ${fileKey}`);

    // Check if file exists first
    const fileExists = await s3.file(fileKey).exists();
    if (!fileExists) {
      throw new Error(`File not found in S3: ${fileKey}`);
    }

    const arrayBuffer = await s3.file(fileKey).arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length === 0) {
      throw new Error(`Downloaded file is empty: ${fileKey}`);
    }

    console.log(`✅ [CreateFileRecord] Downloaded ${fileBuffer.length} bytes`);
  } catch (error) {
    console.error(
      `❌ [CreateFileRecord] Error downloading file from S3:`,
      error
    );
    throw new Error(`File not found in S3: ${fileKey}`);
  }

  // Calculate file hash for deduplication
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  console.log(`🔑 [CreateFileRecord] File hash: ${fileHash}`);

  // Check if file with same hash already exists
  const existingFile = await db.query.files.findFirst({
    where: eq(files.fileHash, fileHash),
  });

  if (existingFile) {
    console.log(
      `♻️ [CreateFileRecord] File already exists (ID: ${existingFile.id}), returning existing file`
    );

    // Generate presigned URL for existing file
    let url = "";
    if (existingFile.syyclops_path) {
      try {
        url = s3.file(existingFile.syyclops_path).presign({
          expiresIn: 3600,
          method: "GET",
        });
      } catch (error) {
        console.error(
          "Error generating presigned URL for existing file:",
          error
        );
      }
    }

    // Clean up the duplicate file we just uploaded
    try {
      await s3.file(fileKey).delete();
      console.log(
        `🗑️ [CreateFileRecord] Cleaned up duplicate file: ${fileKey}`
      );
    } catch (error) {
      console.error("Error cleaning up duplicate file:", error);
    }

    return {
      id: existingFile.id,
      name: existingFile.name,
      mimeType: existingFile.mimeType || mimeType,
      size: existingFile.size || 0,
      fileKey: existingFile.syyclops_path || "",
      url,
      category: existingFile.category as "drawing" | "document" | undefined,
      isExisting: true,
    };
  }

  // Insert new file into files table
  const [insertedFile] = await db
    .insert(files)
    .values({
      name: fileName,
      mimeType: mimeType,
      size: size,
      type: "file",
      fileHash: fileHash,
      syyclops_path: fileKey,
      file_origin_type: "syyclops",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  console.log(
    `✅ [CreateFileRecord] File inserted into database: ${insertedFile.id}`
  );

  // Process file content
  let category: "drawing" | "document" | undefined;
  try {
    console.log(
      `⚙️ [CreateFileRecord] Processing file content for: ${fileName}`
    );
    const processedResult = await processFile(fileBuffer, fileName, mimeType);

    const { pages: processedFilePages, category: detectedCategory } =
      processedResult;
    category = detectedCategory;

    // Update the file record with the determined category
    if (category) {
      await db
        .update(files)
        .set({ category })
        .where(eq(files.id, insertedFile.id));

      console.log(`📂 [CreateFileRecord] File categorized as: ${category}`);
    }

    // Store processed file pages in database
    for (const pageData of processedFilePages) {
      const [insertedPage] = await db
        .insert(filePages)
        .values({
          fileId: insertedFile.id,
          pageNumber: pageData.pageNumber,
        })
        .returning();

      // Store chunks for this page
      if (pageData.chunks && pageData.chunks.length > 0) {
        const chunkValues = pageData.chunks.map((chunk) => ({
          filePageId: insertedPage.id,
          content: chunk.content,
          position: chunk.position,
        }));
        await db.insert(filePageChunks).values(chunkValues);
      }

      // Store images for this page
      if (pageData.images && pageData.images.length > 0) {
        const imageValues = pageData.images.map((image) => ({
          filePageId: insertedPage.id,
          name: image.name,
          imagePath: image.path,
        }));
        await db.insert(filePageImages).values(imageValues);
      }
    }

    console.log(
      `✅ [CreateFileRecord] File processing completed: ${processedFilePages.length} pages processed`
    );
  } catch (processingError) {
    console.error(
      `❌ [CreateFileRecord] Error processing file ${fileName}:`,
      processingError
    );
    // Continue even if processing fails - the file is still stored
  }

  // Generate presigned URL for the uploaded file
  const url = s3.file(fileKey).presign({
    expiresIn: 3600,
    method: "GET",
  });

  return {
    id: insertedFile.id,
    name: insertedFile.name,
    mimeType: insertedFile.mimeType || mimeType,
    size: insertedFile.size || 0,
    fileKey,
    url,
    category,
    isExisting: false,
  };
}
