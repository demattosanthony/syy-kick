import { desc, eq, and, ilike, sql, inArray } from "drizzle-orm";
import db from "../../config/db";
import s3 from "../../config/s3";
import reranker from "../../config/reranker";
import crypto from "crypto";
import {
  files,
  filePages,
  filePageChunks,
  filePageImages,
  userFiles,
  messages,
  messagesFiles,
} from "../../config/schema";
import type {
  GetFilesQuery,
  PaginatedFiles,
  File,
  GetFilesOptions,
} from "./files.schemas";
import { processFile } from "./files.processor";

export async function getFiles({
  context,
  query = { page: 1, limit: 20 },
  includePresignedUrls = true,
}: GetFilesOptions): Promise<PaginatedFiles> {
  const { page, limit, search, type, category, file_origin_type } = query;
  const offset = (page - 1) * limit;

  // Build the base where conditions for files table
  const fileConditions = [];
  if (type) {
    fileConditions.push(eq(files.type, type));
  }
  if (category) {
    fileConditions.push(eq(files.category, category));
  }
  if (file_origin_type) {
    fileConditions.push(eq(files.file_origin_type, file_origin_type));
  }
  if (search) {
    fileConditions.push(ilike(files.name, `%${search}%`));
  }

  let filesQuery;
  let totalQuery;

  // Build queries based on context type
  switch (context.type) {
    case "user": {
      const baseConditions = [
        eq(userFiles.userId, context.userId),
        ...fileConditions,
      ];

      filesQuery = db
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
        .innerJoin(userFiles, eq(files.id, userFiles.fileId))
        .where(and(...baseConditions))
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);

      totalQuery = db
        .select({ count: sql<number>`count(distinct ${files.id})` })
        .from(files)
        .innerJoin(userFiles, eq(files.id, userFiles.fileId))
        .where(and(...baseConditions));
      break;
    }

    case "thread": {
      // Get all messages in the thread first
      const threadMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, context.threadId),
      });

      if (threadMessages.length === 0) {
        return {
          files: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }

      const messageIds = threadMessages.map((msg) => msg.id);
      const baseConditions = [
        inArray(messagesFiles.messageId, messageIds),
        ...fileConditions,
      ];

      filesQuery = db
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
        .where(and(...baseConditions))
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);

      totalQuery = db
        .select({ count: sql<number>`count(distinct ${files.id})` })
        .from(files)
        .innerJoin(messagesFiles, eq(files.id, messagesFiles.fileId))
        .where(and(...baseConditions));
      break;
    }

    case "fileIds": {
      const baseConditions = [
        inArray(files.id, context.fileIds),
        ...fileConditions,
      ];

      filesQuery = db
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
        .where(and(...baseConditions))
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);

      totalQuery = db
        .select({ count: sql<number>`count(distinct ${files.id})` })
        .from(files)
        .where(and(...baseConditions));
      break;
    }

    default:
      throw new Error(`Unsupported context type: ${(context as any).type}`);
  }

  const [filesResult, totalResult] = await Promise.all([
    filesQuery,
    totalQuery,
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  // Generate presigned URLs if requested
  let filesWithUrls = filesResult;
  if (includePresignedUrls) {
    filesWithUrls = await Promise.all(
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
  }

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

export async function getFilesForUser(
  userId: string,
  query: GetFilesQuery
): Promise<PaginatedFiles> {
  return getFiles({
    context: { type: "user", userId },
    query,
    includePresignedUrls: true,
  });
}

export async function getFilesForThread(
  threadId: string,
  query: GetFilesQuery = { page: 1, limit: 20 }
): Promise<PaginatedFiles> {
  return getFiles({
    context: { type: "thread", threadId },
    query,
    includePresignedUrls: true,
  });
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
  const fileKey = `files/${uniqueFileName}`;

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

export async function processAndStoreFile(params: {
  userId: string;
  fileName: string;
  mimeType: string;
  size: number;
  fileBuffer: Buffer;
  fileOriginType: "syyclops" | "sharepoint" | "google_drive";
  filePath?: string; // S3 key, SharePoint path, etc.
  deduplicationStrategy?: "hash" | "path";
  pathColumn?: "syyclops_path" | "sharepoint_path" | "google_drive_path";
}): Promise<{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  filePath?: string;
  url?: string;
  category?: "drawing" | "document";
  isExisting: boolean;
}> {
  const {
    userId,
    fileName,
    mimeType,
    size,
    fileBuffer,
    fileOriginType,
    filePath,
    deduplicationStrategy = "hash",
    pathColumn = "syyclops_path",
  } = params;

  console.log(
    `📄 [ProcessAndStoreFile] Processing file: ${fileName} (${mimeType}) from ${fileOriginType}`
  );

  // Handle deduplication based on strategy
  let existingFile = null;

  if (deduplicationStrategy === "hash") {
    // Calculate file hash for deduplication
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");
    console.log(`🔑 [ProcessAndStoreFile] File hash: ${fileHash}`);

    // Check if file with same hash already exists for this user
    existingFile = await db
      .select({
        id: files.id,
        name: files.name,
        mimeType: files.mimeType,
        size: files.size,
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
      .innerJoin(userFiles, eq(files.id, userFiles.fileId))
      .where(and(eq(userFiles.userId, userId), eq(files.fileHash, fileHash)))
      .limit(1)
      .then((rows) => rows[0] || null);

    if (existingFile) {
      console.log(
        `♻️ [ProcessAndStoreFile] File already exists for user (ID: ${existingFile.id}), returning existing file`
      );
      return {
        id: existingFile.id,
        name: existingFile.name,
        mimeType: existingFile.mimeType || mimeType,
        size: existingFile.size || 0,
        filePath: existingFile[pathColumn] || "",
        category: existingFile.category as "drawing" | "document" | undefined,
        isExisting: true,
      };
    }

    // Check if the file hash exists globally and create a new user association
    const globalExistingFile = await db.query.files.findFirst({
      where: eq(files.fileHash, fileHash),
    });

    if (globalExistingFile) {
      console.log(
        `🔗 [ProcessAndStoreFile] File hash exists globally (ID: ${globalExistingFile.id}), creating user association`
      );

      // Create user-file association
      await db.insert(userFiles).values({
        userId,
        fileId: globalExistingFile.id,
      });

      return {
        id: globalExistingFile.id,
        name: globalExistingFile.name,
        mimeType: globalExistingFile.mimeType || mimeType,
        size: globalExistingFile.size || 0,
        filePath: globalExistingFile[pathColumn] || "",
        category: globalExistingFile.category as
          | "drawing"
          | "document"
          | undefined,
        isExisting: true,
      };
    }
  } else if (deduplicationStrategy === "path" && filePath) {
    // Check if file already exists by path
    const pathCondition =
      pathColumn === "sharepoint_path"
        ? eq(files.sharepoint_path, filePath)
        : pathColumn === "google_drive_path"
          ? eq(files.google_drive_path, filePath)
          : eq(files.syyclops_path, filePath);

    existingFile = await db.query.files.findFirst({
      where: pathCondition,
    });

    if (existingFile) {
      console.log(
        `✅ [ProcessAndStoreFile] File already indexed by path: ${existingFile.name}`
      );

      // Ensure user-file association exists
      const existingUserFile = await db.query.userFiles.findFirst({
        where: and(
          eq(userFiles.userId, userId),
          eq(userFiles.fileId, existingFile.id)
        ),
      });

      if (!existingUserFile) {
        await db.insert(userFiles).values({
          userId,
          fileId: existingFile.id,
        });
        console.log(`🔗 [ProcessAndStoreFile] Created user-file association`);
      }

      return {
        id: existingFile.id,
        name: existingFile.name,
        mimeType: existingFile.mimeType || mimeType,
        size: existingFile.size || 0,
        filePath: existingFile[pathColumn] || "",
        category: existingFile.category as "drawing" | "document" | undefined,
        isExisting: true,
      };
    }
  }

  // Calculate file hash if not already done
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Prepare file data for insertion
  const fileData: any = {
    name: fileName,
    mimeType: mimeType,
    size: size,
    type: "file",
    fileHash: fileHash,
    file_origin_type: fileOriginType,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Set the appropriate path column
  if (filePath) {
    fileData[pathColumn] = filePath;
  }

  // Insert new file into files table
  const [insertedFile] = await db.insert(files).values(fileData).returning();

  console.log(
    `✅ [ProcessAndStoreFile] File inserted into database: ${insertedFile.id}`
  );

  // Create user-file association
  await db.insert(userFiles).values({
    userId,
    fileId: insertedFile.id,
  });

  console.log(
    `🔗 [ProcessAndStoreFile] User-file association created for user: ${userId}`
  );

  // Process file content
  let category: "drawing" | "document" | undefined;
  try {
    console.log(
      `⚙️ [ProcessAndStoreFile] Processing file content for: ${fileName}`
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

      console.log(`📂 [ProcessAndStoreFile] File categorized as: ${category}`);
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

        // Batch insert chunks to avoid parameter limit issues
        const BATCH_SIZE = 1000;
        for (let i = 0; i < chunkValues.length; i += BATCH_SIZE) {
          const batch = chunkValues.slice(i, i + BATCH_SIZE);
          await db.insert(filePageChunks).values(batch);
        }

        console.log(
          `✅ [ProcessAndStoreFile] Inserted ${chunkValues.length} chunks in batches of ${BATCH_SIZE}`
        );
      }

      // Store images for this page
      if (pageData.images && pageData.images.length > 0) {
        const imageValues = pageData.images.map((image) => ({
          filePageId: insertedPage.id,
          name: image.name,
          imagePath: image.path,
          size: image.size,
        }));
        await db.insert(filePageImages).values(imageValues);
      }
    }

    console.log(
      `✅ [ProcessAndStoreFile] File processing completed: ${processedFilePages.length} pages processed`
    );
  } catch (processingError) {
    console.error(
      `❌ [ProcessAndStoreFile] Error processing file ${fileName}:`,
      processingError
    );
    // Continue even if processing fails - the file is still stored
  }

  return {
    id: insertedFile.id,
    name: insertedFile.name,
    mimeType: insertedFile.mimeType || mimeType,
    size: insertedFile.size || 0,
    filePath: insertedFile[pathColumn] || "",
    category,
    isExisting: false,
  };
}

export async function getFileContent(
  fileId: string,
  options: {
    startPage?: number;
    endPage?: number;
    startChunk?: number;
    endChunk?: number;
  } = {}
): Promise<{
  content: string;
  totalPages: number;
  totalChunks: number;
  pageInfo?: string;
  pageIds: string[];
}> {
  const { startPage, endPage, startChunk, endChunk } = options;

  const pages = await db.query.filePages.findMany({
    where: eq(filePages.fileId, fileId),
    with: {
      chunks: {
        orderBy: (chunks, { asc }) => [asc(chunks.position)],
      },
    },
    orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
  });

  if (pages.length === 0) {
    return {
      content: "No content found for this file.",
      totalPages: 0,
      totalChunks: 0,
      pageIds: [],
    };
  }

  const totalPages = pages.length;
  const totalChunks = pages.reduce((sum, page) => sum + page.chunks.length, 0);

  // Get file info to determine if it's PDF
  const file = await db.query.files.findFirst({
    where: eq(files.id, fileId),
  });

  let selectedPages: typeof pages = [];
  let pageInfo = "";

  // Handle PDF pagination (by pages)
  if (file?.mimeType === "application/pdf" && (startPage || endPage)) {
    const start = Math.max((startPage || 1) - 1, 0);
    const end = Math.min(
      (endPage || startPage || totalPages) - 1,
      totalPages - 1
    );
    selectedPages = pages.slice(start, end + 1);
    pageInfo = `Pages ${start + 1}-${end + 1} of ${totalPages}`;
  }
  // Handle chunk pagination
  else if (startChunk || endChunk) {
    const allChunks = pages.flatMap((page) =>
      page.chunks.map((chunk) => ({ ...chunk, pageId: page.id }))
    );
    const start = Math.max((startChunk || 1) - 1, 0);
    const end = Math.min(
      (endChunk || allChunks.length) - 1,
      allChunks.length - 1
    );
    const selectedChunks = allChunks.slice(start, end + 1);
    const pageIds = [...new Set(selectedChunks.map((chunk) => chunk.pageId))];
    selectedPages = pages.filter((page) => pageIds.includes(page.id));
    pageInfo = `Chunks ${start + 1}-${end + 1} of ${totalChunks}`;
  }
  // Default behavior
  else {
    if (file?.mimeType === "application/pdf") {
      selectedPages = [pages[0]];
      pageInfo = `Page 1 of ${totalPages}`;
    } else {
      const allChunks = pages.flatMap((page) =>
        page.chunks.map((chunk) => ({ ...chunk, pageId: page.id }))
      );
      const firstChunks = allChunks.slice(0, 10);
      const pageIds = [...new Set(firstChunks.map((chunk) => chunk.pageId))];
      selectedPages = pages.filter((page) => pageIds.includes(page.id));
      pageInfo = `Chunks 1-${firstChunks.length} of ${totalChunks}`;
    }
  }

  const content = selectedPages
    .map((page) => {
      const pageContent = page.chunks.map((chunk) => chunk.content).join("\n");
      return file?.mimeType === "application/pdf" && (startPage || endPage)
        ? `=== Page ${page.pageNumber} ===\n${pageContent}`
        : pageContent;
    })
    .join("\n\n");

  return {
    content,
    totalPages,
    totalChunks,
    pageInfo,
    pageIds: selectedPages.map((page) => page.id),
  };
}

export async function searchFileContent(
  fileId: string,
  query: string,
  limit: number = 5
): Promise<{
  content: string;
  matches: number;
  pageIds: string[];
}> {
  const pages = await db.query.filePages.findMany({
    where: eq(filePages.fileId, fileId),
    with: {
      chunks: {
        orderBy: (chunks, { asc }) => [asc(chunks.position)],
      },
    },
    orderBy: (pages, { asc }) => [asc(pages.pageNumber)],
  });

  if (pages.length === 0) {
    return {
      content: "No content found for this file.",
      matches: 0,
      pageIds: [],
    };
  }

  const allChunks = pages.flatMap((page) =>
    page.chunks.map((chunk) => ({
      ...chunk,
      pageNumber: page.pageNumber,
      pageId: page.id,
    }))
  );

  if (allChunks.length === 0) {
    return {
      content: `No content found matching "${query}".`,
      matches: 0,
      pageIds: [],
    };
  }

  try {
    // Use reranker for semantic search
    const chunkTexts = allChunks.map((chunk) => chunk.content);
    const rerankedResults = await reranker.rerank(query, chunkTexts, {
      topN: Math.min(limit, 10),
      returnDocuments: true,
    });

    if (!rerankedResults.results?.length) {
      return {
        content: `No content found matching "${query}".`,
        matches: 0,
        pageIds: [],
      };
    }

    const rankedChunks = rerankedResults.results
      .map((result: any) => {
        const originalChunk = allChunks.find(
          (chunk) => chunk.content === result.document.text
        );
        return originalChunk
          ? { ...originalChunk, score: result.relevance_score }
          : null;
      })
      .filter((chunk): chunk is NonNullable<typeof chunk> => chunk !== null);

    const content = rankedChunks
      .map(
        (chunk: any, index: number) =>
          `=== Match ${index + 1} (Page ${chunk.pageNumber}, Score: ${chunk.score.toFixed(3)}) ===\n${chunk.content}`
      )
      .join("\n\n");

    return {
      content,
      matches: rankedChunks.length,
      pageIds: [
        ...new Set(rankedChunks.map((chunk: any) => chunk.pageId)),
      ] as string[],
    };
  } catch (error) {
    console.error("Reranker error, falling back to text search:", error);

    // Fallback to simple text search
    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 2);
    const scoredChunks = allChunks
      .map((chunk) => {
        const chunkText = chunk.content.toLowerCase();
        let score = 0;
        searchTerms.forEach((term) => {
          const matches = (chunkText.match(new RegExp(term, "g")) || []).length;
          score += matches;
        });
        if (chunkText.includes(query.toLowerCase())) score += 10;
        return { ...chunk, score };
      })
      .filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scoredChunks.length === 0) {
      return {
        content: `No content found matching "${query}".`,
        matches: 0,
        pageIds: [],
      };
    }

    const content = scoredChunks
      .map(
        (chunk: any, index: number) =>
          `=== Match ${index + 1} (Page ${chunk.pageNumber}, Score: ${chunk.score.toFixed(3)}) ===\n${chunk.content}`
      )
      .join("\n\n");

    return {
      content,
      matches: scoredChunks.length,
      pageIds: [
        ...new Set(scoredChunks.map((chunk: any) => chunk.pageId)),
      ] as string[],
    };
  }
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

  // Use the new generic function
  const result = await processAndStoreFile({
    userId,
    fileName,
    mimeType,
    size,
    fileBuffer,
    fileOriginType: "syyclops",
    filePath: fileKey,
    deduplicationStrategy: "hash",
    pathColumn: "syyclops_path",
  });

  // Handle cleanup for existing files
  if (result.isExisting && result.filePath !== fileKey) {
    // Clean up the duplicate file we just uploaded
    try {
      await s3.file(fileKey).delete();
      console.log(
        `🗑️ [CreateFileRecord] Cleaned up duplicate file: ${fileKey}`
      );
    } catch (error) {
      console.error("Error cleaning up duplicate file:", error);
    }
  }

  // Generate presigned URL for the file
  let url = "";
  const effectiveFileKey = result.filePath || fileKey;
  if (effectiveFileKey) {
    try {
      url = s3.file(effectiveFileKey).presign({
        expiresIn: 3600,
        method: "GET",
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
    }
  }

  return {
    id: result.id,
    name: result.name,
    mimeType: result.mimeType,
    size: result.size,
    fileKey: effectiveFileKey,
    url,
    category: result.category,
    isExisting: result.isExisting,
  };
}
