import { Project } from "./project";

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
  status: "completed" | "failed" | "pending";
  toolCallId: string;
  toolName: string;
  result?: any;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: string;
  attachments?: MessageAttachment[];
  toolCalls?: ChatToolCall[];
  model?: string;
  provider?: string;
  reasoning?: string;
};

export type FileUpload = {
  file: File;
  preview: string;
  type: "image" | "pdf";
};

export interface Thread {
  id: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  organizationId?: string;
  projectId?: string;
  project?: Project;
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
