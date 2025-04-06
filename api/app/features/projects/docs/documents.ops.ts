import {
  and,
  asc,
  cosineDistance,
  eq,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import db from "../../../config/db";
import { projectsOps } from "../projects.ops";
import { normalizePath } from "./documents.utils";
import {
  documentEmbeddings,
  documents,
  projects,
} from "../../../config/schema";
import s3 from "../../../config/s3";
import { documentsSchemas } from "./documents.schemas";
import { z } from "zod";
import { Workspace } from "../../../middleware";
import { smallOpenaiEmbeddingModel } from "../../models";
import { ALLOWED_UNSTRUCTURED_EXTENSIONS } from "../../../config/unstructured";
import { queue } from "../../../doc-job-queue";
import { DocumentSearchResult } from "./documents.types";

export const documentsOps = {
  getProjectDocs: async (projectId: string, path: string = "") => {
    await projectsOps.getProjectOrThrow(projectId);

    try {
      const normalizedPath = normalizePath(path);

      // If path is not empty, first find the folder document to get its ID
      let parentId: string | null = null;
      if (normalizedPath !== "") {
        const folder = await db.query.documents.findFirst({
          where: and(
            eq(documents.projectId, projectId),
            eq(documents.path, normalizedPath),
            eq(documents.type, "folder")
          ),
        });
        // Instead of throwing an error, return an empty array if folder not found
        if (!folder) {
          console.log(
            `Folder not found at path: ${normalizedPath} for project: ${projectId}`
          );
          return [];
        }
        parentId = folder.id;
      }

      const docs = await db.query.documents.findMany({
        where: and(
          eq(documents.projectId, projectId),
          parentId === null
            ? isNull(documents.parentId)
            : eq(documents.parentId, parentId)
        ),
        with: {
          processingJob: true,
        },
        orderBy: [asc(documents.type), asc(documents.name)],
      });

      // Add presigned URLs for files
      const docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          if (doc.type === "file" && doc.fileKey) {
            const url = s3.presign(doc.fileKey, {
              expiresIn: 60 * 60, // 1 hour
            });
            return { ...doc, url };
          }
          return doc;
        })
      );

      // Filter out . files and sort the results GitHub-style
      return docsWithUrls
        .filter((doc) => !doc.name.startsWith(".")) // Filter out dot files
        .sort((a, b) => {
          // First sort by type (folders first)
          if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1;
          }

          // Then sort by name (case-insensitive)
          const nameA = a.name.toLowerCase();
          const nameB = b.name.toLowerCase();

          // Natural sort for numbers (e.g., "file2" comes before "file10")
          return nameA.localeCompare(nameB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });
    } catch (error) {
      console.log("Error getting project contents:", error);
      throw new Error("Failed to fetch project contents");
    }
  },

  deleteProjectContent: async (projectId: string, path: string) => {
    await projectsOps.getProjectOrThrow(projectId);

    try {
      // Get all documents at and below this path
      const docsToDelete = await db.query.documents.findMany({
        where: and(
          eq(documents.projectId, projectId),
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
            eq(documents.projectId, projectId),
            or(eq(documents.path, path), like(documents.path, `${path}/%`))
          )
        );

      return true;
    } catch (error: any) {
      console.error("Delete content error:", error);
      if (error.message.includes("not found")) {
        throw new Error(`Path '${path}' not found`);
      }
      throw new Error("Failed to delete content");
    }
  },

  getDocContent: async (projectId: string, path: string) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.projectId, projectId), eq(documents.path, path)),
    });

    if (!document) {
      console.log(`Document not found at path: ${path}`);
      throw new Error("File not found");
    }

    if (document.type === "folder") {
      throw new Error("Cannot get content of a folder");
    }

    // If document has a fileKey, generate a presigned URL for S3 access
    if (document.fileKey) {
      const url = s3.presign(document.fileKey, {
        expiresIn: 60 * 60, // 1 hour
        method: "GET",
      });

      return {
        ...document,
        url,
      };
    }

    return document;
  },

  ensureParentFolderExists: async (
    projectId: string,
    fullPath: string
  ): Promise<string | null> => {
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
        eq(documents.projectId, projectId),
        eq(documents.path, normalizedParentPath),
        eq(documents.type, "folder")
      ),
    });

    // If not found, recursively create that parent
    if (!parent) {
      // Create the parent's parent first
      const grandParentId = await documentsOps.ensureParentFolderExists(
        projectId,
        normalizedParentPath
      );

      // Insert the parent folder
      const [parentDoc] = await db
        .insert(documents)
        .values({
          name: normalizedParentPath.split("/").pop()!,
          path: normalizedParentPath,
          type: "folder",
          projectId,
          parentId: grandParentId,
        })
        .returning();

      parent = parentDoc;
    }

    return parent.id;
  },

  createFolderStructure: async (
    projectId: string,
    data: z.infer<typeof documentsSchemas.docsUpload>
  ) => {
    // Keep track of any paths created this run to avoid re-inserting
    const createdThisRun = new Set<string>();
    const createdDocs: any[] = [];

    for (const entry of data.entries) {
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
        // You can log or handle this any way you prefer
        console.log(`Skipping hidden file/folder: ${fullPath}`);
        continue;
      }

      // If we've already processed this path in the same request, skip
      if (createdThisRun.has(fullPath)) {
        continue;
      }

      // 3. Check if there's already a doc with this exact path in DB
      //    If so, skip (or handle it how you like—maybe overwrite)
      const existingDoc = await db.query.documents.findFirst({
        where: and(
          eq(documents.projectId, projectId),
          eq(documents.path, fullPath)
        ),
      });
      if (existingDoc) {
        continue; // or throw an error or update, depending on your needs
      }

      // 4. Ensure parent folder exists (only if there's a parent path)
      let parentId: string | null = null;
      if (fullPath.includes("/")) {
        parentId = await documentsOps.ensureParentFolderExists(
          projectId,
          fullPath
        );
      }

      // 5. Insert the folder or file
      const [newDoc] = await db
        .insert(documents)
        .values({
          name: fullPath.split("/").pop()!,
          type: entry.type,
          path: fullPath,
          parentId,
          projectId,
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

    // Process uploaded files in the background
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
  },

  searchProjectDocuments: async (params: {
    query: string;
    workspace: Workspace;
    projectIds?: string[];
    documentId?: string;
    limit?: number;
  }): Promise<DocumentSearchResult[]> => {
    const { projectIds, query, limit = 20, workspace, documentId } = params;
    try {
      // If projectIds are provided, verify they exist
      if (projectIds && projectIds.length > 0) {
        try {
          // Verify at least one project exists (could enhance to check all)
          await projectsOps.getProjectOrThrow(projectIds[0]);
        } catch (error) {
          console.error(
            `Project verification failed for ID ${projectIds[0]}:`,
            error
          );
          throw new Error(`Invalid project ID: ${projectIds[0]}`);
        }
      } else if (!workspace.id) {
        throw new Error(
          "Either projectIds, userId, or organizationId must be provided"
        );
      }

      // Get the embedding for the search query
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

      // Build the where clause based on provided parameters
      const similarityThreshold = 0.45; // Define threshold
      const similaritySql = sql<number>`1 - (${cosineDistance(
        documentEmbeddings.embedding,
        queryEmbedding
      )})`;
      let whereClause;
      if (documentId) {
        // Search within specific document
        whereClause = and(
          eq(documentEmbeddings.documentId, documentId),
          sql`${similaritySql} > ${similarityThreshold}`
        );
      } else if (projectIds && projectIds.length > 0) {
        // Search within specific projects
        whereClause = and(
          inArray(documents.projectId, projectIds), // Filter on documents table
          sql`${similaritySql} > ${similarityThreshold}`
        );
      } else if (workspace.type === "organization") {
        console.warn(
          "Organization search requested without specific projectIds. Returning empty."
        );
        return [];
      } else if (workspace.type === "personal") {
        // Search across all projects owned by the user
        whereClause = and(
          eq(projects.userId, workspace.id),
          sql`${similaritySql} > ${similarityThreshold}`
        );
      } else {
        throw new Error("Invalid search scope configuration.");
      }

      // Search for similar documents using vector similarity
      const chunkResults = await db
        .select({
          // Select chunk details explicitly
          chunkText: documentEmbeddings.text,
          chunkMetadata: documentEmbeddings.metadata,
          similarity: similaritySql.as("similarity"),
          // Select full related objects needed for grouping
          document: documents,
          project: projects,
        })
        .from(documentEmbeddings)
        // Join documents first to filter by projectId or userId via projects
        .innerJoin(documents, eq(documents.id, documentEmbeddings.documentId))
        .innerJoin(projects, eq(projects.id, documents.projectId))
        .where(whereClause) // Apply the constructed where clause
        .orderBy(sql`${similaritySql} DESC`) // Order by similarity descending
        .limit(limit);

      console.log(
        `Retrieved ${chunkResults.length} relevant document chunks for query: "${query}"`
      );

      if (chunkResults.length === 0) {
        return [];
      }

      // --- Group Chunks by Document ---
      const documentsMap = new Map<string, DocumentSearchResult>();

      for (const chunk of chunkResults) {
        const docId = chunk.document.id;
        const currentChunkData = {
          text: chunk.chunkText || "",
          metadata: chunk.chunkMetadata as any,
          similarity: chunk.similarity,
        };

        if (!documentsMap.has(docId)) {
          // First time seeing this document, create a new entry
          documentsMap.set(docId, {
            document: chunk.document, // Store the full document object
            project: chunk.project, // Store the full project object
            chunks: [currentChunkData], // Start the chunks array
            maxSimilarity: chunk.similarity, // Initial max similarity
          });
        } else {
          // Document already exists, add the chunk and update max similarity
          const existingEntry = documentsMap.get(docId)!; // Safe due to the check above
          existingEntry.chunks.push(currentChunkData);
          existingEntry.maxSimilarity = Math.max(
            existingEntry.maxSimilarity,
            chunk.similarity
          );
        }
      }

      // --- Sort Documents by Max Similarity ---
      let groupedResults = Array.from(documentsMap.values()).sort(
        (a, b) => b.maxSimilarity - a.maxSimilarity
      );

      // --- Add Presigned URLs ---
      const resultsWithUrls = await Promise.all(
        groupedResults.map(async (result) => {
          // Sort chunks within each document by similarity descending (optional but good UX)
          result.chunks.sort((a, b) => b.similarity - a.similarity);

          if (result.document.fileKey) {
            try {
              const url = s3.presign(result.document.fileKey, {
                expiresIn: 60 * 60, // 1 hour
              });
              return {
                ...result,
                document: {
                  ...result.document,
                  url, // Add the presigned URL to the document object
                },
              };
            } catch (error) {
              console.error(
                `Failed to generate presigned URL for file ${result.document.fileKey}:`,
                error
              );
              // Return the result without URL rather than failing
              return result;
            }
          }
          return result; // Return as is if no fileKey
        })
      );

      console.log(`Grouped into ${resultsWithUrls.length} unique documents.`);

      return resultsWithUrls;
    } catch (error) {
      console.error("Error in searchProjectDocuments:", error);
      throw error;
    }
  },

  getDocumentEmbeddings: async (projectId: string, path: string) => {
    const document = await db.query.documents.findFirst({
      where: and(eq(documents.projectId, projectId), eq(documents.path, path)),
    });

    if (!document) {
      throw new Error(`Document not found at path: ${path}`);
    }

    if (document.type === "folder") {
      throw new Error("Cannot read contents of a folder");
    }

    // Get all embeddings chunks for this document
    const embeddings = await db.query.documentEmbeddings.findMany({
      where: eq(documentEmbeddings.documentId, document.id),
      orderBy: asc(documentEmbeddings.createdAt), // Maintain original text order
    });

    return {
      document,
      embeddings,
    };
  },
};
