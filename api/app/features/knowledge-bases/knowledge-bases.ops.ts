import {
  and,
  asc,
  cosineDistance,
  count,
  desc,
  eq,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  documentEmbeddings,
  documents,
  knowledgeBases,
} from "../../config/schema";
import db from "../../config/db";
import { schemas } from "./knowledge-bases.schemas";
import { getKnowledgeBaseOrThrow } from "./knowledge-bases.utils";
import s3 from "../../config/s3";
import { ALLOWED_UNSTRUCTURED_EXTENSIONS } from "../../config/unstructured";
import { queue } from "../../doc-job-queue";
import { smallOpenaiEmbeddingModel } from "../models";

export async function createKnowledgeBase(
  data: z.infer<typeof schemas.createKnowledgeBase>,
  createdBy: string
) {
  const [kb] = await db
    .insert(knowledgeBases)
    .values({
      name: data.name,
      description: data.description,
      organizationId: data.organizationId,
      userId: data.userId,
      createdBy,
    })
    .returning();
  return kb;
}

export async function listKnowledgeBases(
  userId: string,
  organizationId?: string,
  page: number = 1,
  pageSize: number = 10,
  searchQuery?: string
) {
  let conditions = organizationId
    ? [eq(knowledgeBases.organizationId, organizationId)]
    : [eq(knowledgeBases.userId, userId)];

  // Add search condition if a search query is provided
  if (searchQuery && searchQuery.trim() !== "") {
    const searchTerm = `%${searchQuery.trim().toLowerCase()}%`;
    // Use case-insensitive search by converting both the search term and the name to lowercase
    conditions.push(like(sql`LOWER(${knowledgeBases.name})`, searchTerm));
  }

  const offset = (page - 1) * pageSize;

  const results = await db.query.knowledgeBases.findMany({
    where: and(...conditions),
    limit: pageSize,
    offset: offset,
    orderBy: desc(knowledgeBases.createdAt),
  });

  const totalCount = await db
    .select({ count: count() })
    .from(knowledgeBases)
    .where(and(...conditions))
    .then((res) => res[0].count);

  return {
    data: results,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasMore: page * pageSize < totalCount,
    },
  };
}

export async function getKnowledgeBase(knowledgeBaseId: string) {
  return await getKnowledgeBaseOrThrow(knowledgeBaseId);
}

export async function deleteKnowledgeBase(knowledgeBaseId: string) {
  // Delete associated documents from S3 and DB
  const docs = await db.query.documents.findMany({
    where: eq(documents.knowledgeBaseId, knowledgeBaseId),
  });
  for (const doc of docs) {
    if (doc.fileKey) await s3.delete(doc.fileKey);
  }
  await db
    .delete(documents)
    .where(eq(documents.knowledgeBaseId, knowledgeBaseId));
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, knowledgeBaseId));
}

export async function updateKnowledgeBase(
  knowledgeBaseId: string,
  data: z.infer<typeof schemas.updateKnowledgeBase>
) {
  const kb = await getKnowledgeBaseOrThrow(knowledgeBaseId);
  const [updatedKb] = await db
    .update(knowledgeBases)
    .set({
      name: data.name ?? kb.name,
      description: data.description ?? kb.description,
    })
    .where(eq(knowledgeBases.id, knowledgeBaseId))
    .returning();
  return updatedKb;
}

export async function uploadDocs(
  knowledgeBaseId: string,
  data: z.infer<typeof schemas.docsUpload>
) {
  await getKnowledgeBaseOrThrow(knowledgeBaseId);

  // Keep track of any paths created this run to avoid re-inserting
  const createdThisRun = new Set<string>();
  const createdDocs: any[] = [];

  // Sort entries so folders are created before files; if two folders, shorter path first
  const sortedEntries = [...data.entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.path.length - b.path.length;
  });

  for (const entry of sortedEntries) {
    // 1. Normalize the incoming path
    const normalizedEntryPath = normalizePath(entry.path);

    // 2. Combine with basePath if provided
    const fullPath = data.basePath
      ? normalizePath(`${data.basePath}/${normalizedEntryPath}`)
      : normalizedEntryPath;

    // Extract the final name (file or folder name)
    const finalName = fullPath.split("/").pop()!;

    // Skip hidden files/folders, i.e., any whose final name begins with "."
    if (finalName.startsWith(".")) {
      console.log(`Skipping hidden file/folder: ${fullPath}`);
      continue;
    }

    // If we've already processed this path in the same request, skip
    if (createdThisRun.has(fullPath)) {
      continue;
    }

    // 3. Check if there's already a doc with this exact path in DB
    const existingDoc = await db.query.documents.findFirst({
      where: and(
        eq(documents.knowledgeBaseId, knowledgeBaseId),
        eq(documents.path, fullPath)
      ),
    });
    if (existingDoc) {
      continue; // Skip existing documents
    }

    // 4. Ensure parent folder exists (only if there's a parent path)
    let parentId: string | null = null;
    if (fullPath.includes("/")) {
      parentId = await ensureParentFolderExists(knowledgeBaseId, fullPath);
    }

    // 5. Insert the folder or file
    const [newDoc] = await db
      .insert(documents)
      .values({
        name: fullPath.split("/").pop()!,
        type: entry.type,
        path: fullPath,
        parentId,
        knowledgeBaseId,
        ...(entry.type === "file"
          ? {
              fileKey: entry.fileKey,
              size: entry.size,
              mimeType: entry.mimeType,
              fileHash: entry.sha256,
            }
          : {}),
      })
      .returning();

    // Mark this path as created
    createdThisRun.add(fullPath);
    createdDocs.push(newDoc);
  }

  // Process uploaded files in the background if needed
  for (const doc of createdDocs) {
    const extension = doc.name.toLowerCase().match(/\.[^.]*$/)?.[0];
    if (
      doc.type === "file" &&
      doc.fileKey &&
      ALLOWED_UNSTRUCTURED_EXTENSIONS.includes(extension)
    ) {
      await queue.addToQueue({
        fileKey: doc.fileKey,
        fileName: doc.path,
        mimeType: doc.mimeType || "",
        documentId: doc.id,
      });
    }
  }

  return { success: true };
}

/**
 * Recursively creates missing folder ancestors if they don't exist.
 * Returns the ID of the final parent folder.
 */
async function ensureParentFolderExists(
  knowledgeBaseId: string,
  fullPath: string
): Promise<string | null> {
  // If there's no slash, it means there's no parent folder, e.g. "myFolder"
  if (!fullPath.includes("/")) {
    return null;
  }

  // e.g. parentPath = "folderA" or "folderA/folderB"
  const parentPath = fullPath.split("/").slice(0, -1).join("/");
  const normalizedParentPath = normalizePath(parentPath);

  if (!normalizedParentPath) {
    // This means fullPath was something like "/file.txt" after trimming
    // or there's effectively no real parent. Return null.
    return null;
  }

  // Check if parent folder already exists
  let parent = await db.query.documents.findFirst({
    where: and(
      eq(documents.knowledgeBaseId, knowledgeBaseId),
      eq(documents.path, normalizedParentPath),
      eq(documents.type, "folder")
    ),
  });

  // If not found, recursively create that parent
  if (!parent) {
    // Create the parent's parent first
    const grandParentId = await ensureParentFolderExists(
      knowledgeBaseId,
      normalizedParentPath
    );

    // Insert the parent folder
    const [parentDoc] = await db
      .insert(documents)
      .values({
        name: normalizedParentPath.split("/").pop()!,
        path: normalizedParentPath,
        type: "folder",
        knowledgeBaseId,
        parentId: grandParentId,
      })
      .returning();

    parent = parentDoc;
  }

  return parent.id;
}

/**
 * Normalizes a path:
 * - Trims leading/trailing slashes
 * - Replaces multiple slashes with a single slash
 */
function normalizePath(input: string) {
  // Remove leading/trailing slashes
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  // Replace multiple consecutive slashes with single
  return trimmed.replace(/\/{2,}/g, "/");
}

export async function getDocs(knowledgeBaseId: string, path: string = "") {
  await getKnowledgeBaseOrThrow(knowledgeBaseId);

  try {
    const normalizedPath = path.trim();

    // If path is not empty, first find the folder document to get its ID
    let parentId: string | null = null;
    if (normalizedPath !== "") {
      const folder = await db.query.documents.findFirst({
        where: and(
          eq(documents.knowledgeBaseId, knowledgeBaseId),
          eq(documents.path, normalizedPath),
          eq(documents.type, "folder")
        ),
      });

      // Return an empty array if folder not found
      if (!folder) {
        console.log(
          `Folder not found at path: ${normalizedPath} for knowledge base: ${knowledgeBaseId}`
        );
        return [];
      }
      parentId = folder.id;
    }

    const docs = await db.query.documents.findMany({
      where: and(
        eq(documents.knowledgeBaseId, knowledgeBaseId),
        parentId === null
          ? isNull(documents.parentId)
          : eq(documents.parentId, parentId)
      ),
      with: {
        processingJob: true,
      },
      orderBy: [asc(documents.type), asc(documents.name)],
    });

    // Add presigned URLs for files and sort the results
    const docsWithUrls = await Promise.all(
      docs.map(async (doc) => {
        if (doc.type === "file" && doc.fileKey) {
          const url = await s3.presign(doc.fileKey, { expiresIn: 60 * 60 });
          return { ...doc, url };
        }
        return doc;
      })
    );

    // Filter out dot files and sort GitHub-style
    return docsWithUrls
      .filter((doc) => !doc.name.startsWith("."))
      .sort((a, b) => {
        // Sort by type (folders first)
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }

        // Then sort by name (case-insensitive)
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        // Natural sort for numbers
        return nameA.localeCompare(nameB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  } catch (error) {
    console.log("Error getting knowledge base contents:", error);
    throw new Error("Failed to fetch knowledge base contents");
  }
}

export async function deleteDocs(knowledgeBaseId: string, path: string) {
  await getKnowledgeBaseOrThrow(knowledgeBaseId);

  try {
    // Get all documents at and below this path
    const docsToDelete = await db.query.documents.findMany({
      where: and(
        eq(documents.knowledgeBaseId, knowledgeBaseId),
        // Match exact path or path starting with path/
        or(eq(documents.path, path), like(documents.path, `${path}/%`))
      ),
    });

    if (docsToDelete.length === 0) {
      throw new Error(`Path '${path}' not found`);
    }

    // Delete files from S3 first
    for (const doc of docsToDelete) {
      if (doc.type === "file" && doc.fileKey) {
        try {
          await s3.delete(doc.fileKey);
        } catch (s3Error) {
          console.error(
            `Failed to delete file from S3: ${doc.fileKey}`,
            s3Error
          );
          // Continue with other deletions even if one fails
        }
      }
    }

    // Delete all matching documents from database
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.knowledgeBaseId, knowledgeBaseId),
          or(eq(documents.path, path), like(documents.path, `${path}/%`))
        )
      );

    return true;
  } catch (error: any) {
    console.error("Delete docs error:", error);
    if (error.message.includes("not found")) {
      throw new Error(`Path '${path}' not found`);
    }
    throw new Error("Failed to delete documents");
  }
}

export async function searchKnowledgeBaseDocuments(params: {
  knowledgeBaseId: string;
  query: string;
  limit?: number;
}) {
  const { knowledgeBaseId, query, limit = 20 } = params;

  try {
    // 1. Verify the knowledge base exists
    await getKnowledgeBaseOrThrow(knowledgeBaseId);

    // 2. Get the embedding for the search query
    let queryEmbedding;
    try {
      const { embeddings } = await smallOpenaiEmbeddingModel.doEmbed({
        values: [query],
      });
      queryEmbedding = embeddings[0];
    } catch (error) {
      console.error("Failed to generate embedding for search query:", error);
      throw new Error("Failed to process search query");
    }

    // 3. Build the where clause
    const whereClause = and(
      eq(documents.knowledgeBaseId, knowledgeBaseId),
      // Use a similarity threshold (cosine similarity > 0.45)
      sql`1 - (${cosineDistance(
        documentEmbeddings.embedding,
        queryEmbedding
      )}) > 0.45`
    );

    // 4. Search for similar documents using vector similarity
    const results = await db
      .select({
        documentId: documentEmbeddings.documentId,
        text: documentEmbeddings.text,
        metadata: documentEmbeddings.metadata,
        similarity: sql<number>`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )})`.as("similarity"),
        document: documents,
      })
      .from(documentEmbeddings)
      .innerJoin(documents, eq(documents.id, documentEmbeddings.documentId))
      .where(whereClause)
      .orderBy(
        sql`1 - (${cosineDistance(
          documentEmbeddings.embedding,
          queryEmbedding
        )}) DESC`
      )
      .limit(limit);

    console.log(
      `Found ${results.length} documents in KB ${knowledgeBaseId} matching query: "${query}"`
    );

    // 5. Add presigned URLs for files
    const resultsWithUrls = await Promise.all(
      results.map(async (result) => {
        if (result.document.type === "file" && result.document.fileKey) {
          try {
            const url = await s3.presign(result.document.fileKey, {
              expiresIn: 60 * 60, // 1 hour
            });
            return {
              ...result,
              document: {
                ...result.document,
                url,
              },
            };
          } catch (error) {
            console.error(
              `Failed to generate presigned URL for file ${result.document.fileKey}:`,
              error
            );
            // Return the result without URL rather than failing the entire operation
            return result;
          }
        }
        return result;
      })
    );

    return resultsWithUrls;
  } catch (error) {
    console.error("Error in searchKnowledgeBaseDocuments:", error);
    // Re-throw the original error or a more specific one if needed
    throw error;
  }
}
