export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  visibility: "private" | "public";
  organizationId?: string;
  userId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
