import { Document, Project } from "../../../config/schema";

export type DocumentSearchResult = {
  document: Document & { url?: string };
  project: Project;
  chunks: Array<{
    text: string;
    metadata: any;
    similarity: number;
  }>;
  maxSimilarity: number;
};
