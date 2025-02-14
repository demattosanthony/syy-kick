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

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: MessageContent | null;
  name?: string;
  createdAt?: string;
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
  messages: {
    id: string;
    thread_id: string;
    role: string;
    content: MessageContent;
    createdAt: string;
    model?: string;
    provider?: string;
    reasoning?: string;
  }[];
}
