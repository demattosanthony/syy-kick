import { ChatMessage } from "@/types/chat";

export function convertChatMessagesToMessages(messages: ChatMessage[]) {
  return messages.map((msg) => ({
    id: msg.id,
    role: (msg.role === "tool" ? "data" : msg.role) as
      | "user"
      | "assistant"
      | "system"
      | "data",
    content: msg.text || "",
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    experimental_attachments:
      msg.attachments?.map((att) => ({
        name: att.fileName,
        contentType: att.mimeType,
        url: att.url,
      })) || [],
  }));
}
