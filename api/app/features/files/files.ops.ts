import { desc, eq, and, count, or, ilike, sql } from "drizzle-orm";
import db from "../../config/db";
import {
  files,
  messagesFiles,
  messages,
  filePages,
  filePageChunks,
} from "../../config/schema";
import type { GetFilesQuery, PaginatedFiles, File } from "./files.schemas";

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

  let filesQuery;
  let totalQuery;

  if (search) {
    // Search in both file names and chunk content
    const searchTerm = `%${search}%`;

    // Query files that match search in name or have chunks that match search
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
      .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
      .leftJoin(filePages, eq(files.id, filePages.fileId))
      .leftJoin(filePageChunks, eq(filePages.id, filePageChunks.filePageId))
      .where(
        and(
          ...baseConditions,
          or(
            ilike(files.name, searchTerm),
            ilike(filePageChunks.content, searchTerm)
          )
        )
      )
      .orderBy(desc(files.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for search results
    totalQuery = db
      .select({ count: sql<number>`count(distinct ${files.id})` })
      .from(files)
      .innerJoin(messagesFiles, eq(files.id, messagesFiles.fileId))
      .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
      .leftJoin(filePages, eq(files.id, filePages.fileId))
      .leftJoin(filePageChunks, eq(filePages.id, filePageChunks.filePageId))
      .where(
        and(
          ...baseConditions,
          or(
            ilike(files.name, searchTerm),
            ilike(filePageChunks.content, searchTerm)
          )
        )
      );
  } else {
    // No search - use original query
    filesQuery = db
      .select({
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

    // Get total count
    totalQuery = db
      .select({ count: count() })
      .from(files)
      .innerJoin(messagesFiles, eq(files.id, messagesFiles.fileId))
      .innerJoin(messages, eq(messagesFiles.messageId, messages.id))
      .where(and(...baseConditions));
  }

  const [filesResult, totalResult] = await Promise.all([
    filesQuery,
    totalQuery,
  ]);

  const total = totalResult[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    files: filesResult as File[],
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
