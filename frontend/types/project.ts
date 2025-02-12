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

export interface ProjectContent {
  name: string;
  path: string;
  sha: string;
  lastModified: string;
  content: string;
  type: "file" | "dir";
}

export interface FileResponse {
  name: string;
  path: string;
  size: number;
  type: string;
  sha: string;

  /**
   * True if this file is actually an LFS pointer and large content lives in S3.
   */
  isLfsPointer?: boolean;

  /**
   * For normal text-based files, server returns raw text here.
   */
  content?: string;

  /**
   * For non-text but small files, server returns base64-encoded content directly.
   */
  base64Content?: string;

  /**
   * For LFS-pointer files, server returns a presigned S3 URL here.
   */
  s3Url?: string;
}
