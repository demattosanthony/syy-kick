import { KnowledgeBase } from "../../config/schema";

export type KnowledgeBaseResponse = KnowledgeBase;
export type KnowledgeBaseListResponse = KnowledgeBase[];
export type DocsUploadResponse = { success: boolean };
export type ErrorResponse = { error: string };
