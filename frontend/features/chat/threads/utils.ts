import { Thread } from "@/types/chat";
import { Message } from "ai/react";

export function mapThreadMessagesToMessages(thread: Thread): Message[] {
  if (!thread) return [];

  return (
    thread?.messages
      ?.map(
        (message): Message => ({
          content: message.text,
          role: message.role as "user" | "assistant",
          id: message.id,
          createdAt: message.createdAt
            ? new Date(message.createdAt)
            : undefined,
          reasoning: message.reasoning,
          experimental_attachments: message.attachments?.map((attachment) => ({
            name: attachment.fileName,
            url: attachment.url,
            file_key: attachment.fileKey,
            contentType: attachment.mimeType,
          })),
          toolInvocations: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            toolName: toolCall.toolName,
            status: toolCall.status,
            result: toolCall.result,
            args: toolCall.args,
            toolCallId: toolCall.toolCallId,
            state: "result" as const,
          })),
        })
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      ) ?? []
  );
}
