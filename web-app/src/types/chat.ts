export enum MessageRole {
  system = "system",
  user = "user",
  assistant = "assistant",
  tool = "tool",
}

export type MessageContent = {
  type: "image" | "text" | "file";
  data?: string;
  image?: string;
  text?: string;
  mimeType?: string;
  file_metadata?: {
    filename: string;
    mime_type: string;
    file_key: string;
    size: number;
  };
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  type: "file" | "image";
  fileKey: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ChatToolCall = {
  args: any;
  createdAt: string;
  id: string;
  messageId: string;
  status: "completed" | "failed" | "pending" | "streaming";
  toolCallId: string;
  toolName: string;
  result?: any;
  state: "call" | "result" | "partial-call";
  argsText?: string;
};

export interface ChatMessage {
  id: string;
  threadId: string;
  userId: string;
  role: "system" | "user" | "assistant" | "tool";
  text?: string | null;
  reasoning?: string | null;
  reasoningDurationSeconds?: number | null;
  model?: string | null;
  provider?: string | null;
  status?: "streaming" | "completed" | "failed" | "cancelled";
  error?: string | null;
  embedding?: number[] | null;
  createdAt: string;
  toolCalls?: ChatToolCall[];
  attachments?: MessageAttachment[];
}

export type FileUploadMimeType = "image" | "pdf" | "other";

export type FileUpload = {
  file: File;
  preview: string;
  type: FileUploadMimeType;
  inputId?: string;
  status?: "uploading" | "processing" | "completed" | "error";
  fileKey?: string;
  url?: string;
  error?: string;
};

export interface Thread {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  organizationId?: string;
  isPublic?: boolean;
  workflowId?: string;
  messages: ChatMessage[];
}

export type Artifact = {
  identifier: string;
  type: string;
  title: string;
  content: string;
  isComplete: boolean;
  version?: number;
  autoSelected?: boolean;
};

export interface UpdateThreadMutationData {
  title?: string;
  isPublic?: boolean;
}
