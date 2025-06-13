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
