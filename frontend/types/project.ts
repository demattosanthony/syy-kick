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

  projectNumber?: string;
  estimatedStartDate?: string;
  estimatedEndDate?: string;

  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
}

interface DocumentProcessingJob {
  attempts: number;
  createdAt: string;
  id: number;
  lastError: string;
  processAfter: string;
  status: "pending" | "processing" | "completed" | "failed";
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
  processingJob?: DocumentProcessingJob;
}
