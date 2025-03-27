import { Attachment, CoreMessage } from "ai";
import { MessageAttachment } from "../../config/schema";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

type MyMessage = CoreMessage & {
  experimental_attachments?: ExtendedAttachment[];
};

type ThreadWithMessages = {
  id: string;
  title?: string | null;
  userId: string;
  organizationId?: string | null;
  projectId?: string | null;
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages: {
    id: string;
    threadId: string;
    userId: string;
    role: "system" | "user" | "assistant" | "tool";
    text: string | null;
    reasoning?: string | null;
    model?: string | null;
    provider?: string | null;
    createdAt: Date;
    attachments: MessageAttachment[];
    content?: any;
    toolCalls?: {
      args: any;
      id: string;
      result: any;
      status: string;
      toolName: string;
      toolCallId: string;
    }[];
  }[];
  project?: any;
  organization?: any;
  knowledgeBase?: any;
};

type DocumentSearchToolResult = {
  documentId: string;
  path: string;
  documentName: string;
  text: string | null;
  projectId?: string;
  similarity: number;
  pageNumber?: number;
  knowledgeBaseId?: string;
  mimeType?: string | null;
  fileKey?: string | null;
};

export {
  MyMessage,
  ThreadWithMessages,
  DocumentSearchToolResult,
  ExtendedAttachment,
};
