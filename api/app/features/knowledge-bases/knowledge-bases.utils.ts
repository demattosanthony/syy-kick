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
