import { eq } from "drizzle-orm";
import { knowledgeBases } from "../../config/schema";
import db from "../../config/db";

export async function getKnowledgeBaseOrThrow(knowledgeBaseId: string) {
  const kb = await db.query.knowledgeBases.findFirst({
    where: eq(knowledgeBases.id, knowledgeBaseId),
  });
  if (!kb) {
    throw new Error("Knowledge base not found");
  }
  return kb;
}

/**
 * Normalizes a path:
 * - Trims leading/trailing slashes
 * - Replaces multiple slashes with a single slash
 */
export function normalizePath(input: string) {
  // Remove leading/trailing slashes
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  // Replace multiple consecutive slashes with single
  return trimmed.replace(/\/{2,}/g, "/");
}