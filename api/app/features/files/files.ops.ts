// Third-party dependencies
import { desc, eq, and, ilike, sql, inArray } from "drizzle-orm";

// Local config imports
import db from "../../config/db";
import s3 from "../../config/s3";
import { files, userFiles, messages, messagesFiles } from "../../config/schema";

// Local type imports
import type {
  GetFilesQuery,
  PaginatedFiles,
  File,
  GetFilesOptions,
} from "./files.schemas";

// Local feature imports
import { generateFileSlug } from "../../utils";

export const filesOps = {
  async getFiles({
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
  },

  async getFilesForUser(
    userId: string,
    query: GetFilesQuery
  ): Promise<PaginatedFiles> {
    return this.getFiles({
      context: { type: "user", userId },
      query,
      includePresignedUrls: true,
    });
  },

  async getFilesForThread(
    threadId: string,
    query: GetFilesQuery = { page: 1, limit: 20 }
  ): Promise<PaginatedFiles> {
    return this.getFiles({
      context: { type: "thread", threadId },
      query,
      includePresignedUrls: true,
    });
  },

  async generatePresignedUrl(
    fileName: string,
    mimeType: string,
    size: number,
    pathConfig:
      | { type: "user"; userId: string; featureType: "threads" | "workflows" }
      | { type: "organization"; feature: "avatars" }
  ): Promise<{
    fileKey: string;
    uploadUrl: string;
    viewUrl: string;
  }> {
    // Generate unique file key for S3 based on path configuration
    const fileSlug = generateFileSlug(fileName);
    let fileKey: string;

    switch (pathConfig.type) {
      case "user":
        fileKey = `users/${pathConfig.userId}/${pathConfig.featureType}/${fileSlug}`;
        break;
      case "organization":
        fileKey = `organizations/${pathConfig.feature}/${fileSlug}`;
        break;
      default:
        throw new Error(`Unsupported path configuration type`);
    }

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
  },

  async createFileRecordSimple(
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
    isExisting: boolean;
  }> {
    const { fileName, mimeType, size, fileKey } = fileData;

    console.log(
      `📄 [CreateFileRecord] Creating simple file record: ${fileName} (${mimeType})`
    );

    // Check if file exists in S3 first
    try {
      const fileExists = await s3.file(fileKey).exists();
      if (!fileExists) {
        throw new Error(`File not found in S3: ${fileKey}`);
      }
    } catch (error) {
      console.error(`❌ [CreateFileRecord] File not found in S3:`, error);
      throw new Error(`File not found in S3: ${fileKey}`);
    }

    // Check if file already exists for this user by path
    const existingFile = await db.query.files.findFirst({
      where: eq(files.syyclops_path, fileKey),
    });

    if (existingFile) {
      console.log(
        `♻️ [CreateFileRecord] File already exists (ID: ${existingFile.id}), ensuring user association`
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
        console.log(`🔗 [CreateFileRecord] Created user-file association`);
      }

      // Generate presigned URL
      const url = s3.file(fileKey).presign({
        expiresIn: 3600,
        method: "GET",
      });

      return {
        id: existingFile.id,
        name: existingFile.name,
        mimeType: existingFile.mimeType || mimeType,
        size: existingFile.size || 0,
        fileKey: existingFile.syyclops_path || fileKey,
        url,
        isExisting: true,
      };
    }

    // Create new file record without processing
    const fileData_insert = {
      name: fileName,
      mimeType: mimeType,
      size: size,
      type: "file" as const,
      syyclops_path: fileKey,
      file_origin_type: "syyclops" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [insertedFile] = await db
      .insert(files)
      .values(fileData_insert)
      .returning();

    console.log(
      `✅ [CreateFileRecord] File inserted into database: ${insertedFile.id}`
    );

    // Create user-file association
    await db.insert(userFiles).values({
      userId,
      fileId: insertedFile.id,
    });

    console.log(
      `🔗 [CreateFileRecord] User-file association created for user: ${userId}`
    );

    // Generate presigned URL for the file
    const url = s3.file(fileKey).presign({
      expiresIn: 3600,
      method: "GET",
    });

    return {
      id: insertedFile.id,
      name: insertedFile.name,
      mimeType: insertedFile.mimeType || mimeType,
      size: insertedFile.size || 0,
      fileKey: fileKey,
      url,
      isExisting: false,
    };
  },
};
