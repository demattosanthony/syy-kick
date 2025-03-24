import { and, count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { documents, knowledgeBases } from "../../config/schema";
import db from "../../config/db";
import { schemas } from "./knowledge-bases.schemas";
import { getKnowledgeBaseOrThrow } from "./knowledge-bases.utils";
import s3 from "../../config/s3";

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
  const kb = await getKnowledgeBaseOrThrow(knowledgeBaseId);

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

  const createdDocs = [];
  for (const entry of data.entries) {
    const fullPath = data.basePath
      ? `${data.basePath}/${entry.path}`
      : entry.path;
    const [doc] = await db
      .insert(documents)
      .values({
        name: fullPath.split("/").pop()!,
        type: entry.type,
        path: fullPath,
        knowledgeBaseId,
        fileKey: entry.type === "file" ? entry.fileKey : undefined,
        size: entry.size,
        mimeType: entry.mimeType,
        fileHash: entry.sha256,
      })
      .returning();
    createdDocs.push(doc);
  }
  return { success: true };
}

export async function getDocs(knowledgeBaseId: string, path: string = "") {
  await getKnowledgeBaseOrThrow(knowledgeBaseId);
  const docs = await db.query.documents.findMany({
    where: and(
      eq(documents.knowledgeBaseId, knowledgeBaseId),
      path === "" ? isNull(documents.parentId) : eq(documents.path, path)
    ),
  });

  return await Promise.all(
    docs.map(async (doc) => {
      if (doc.fileKey) {
        const url = await s3.presign(doc.fileKey, { expiresIn: 60 * 60 });
        return { ...doc, url };
      }
      return doc;
    })
  );
}
