import { Organization, User } from "./user";

export interface Project {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  giteaRepoId: number;
  visibility: "private" | "public";
  createdAt: string;
  updatedAt: string;
  organization?: Organization;
  user?: User;
}

export interface DocumentContent {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  createdAt: string;
  updatedAt: string;
  url?: string;
  fileHash?: string;
  mimeType?: string;
  fileKey?: string;
  size?: number;
  extractionStatus?: "pending" | "completed" | "failed" | "skipped";
}
