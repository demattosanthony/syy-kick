import { Thread } from "@/types/chat";
import { Message } from "ai/react";

export function mapThreadMessagesToMessages(
  thread: Thread
): (Message & { parentId?: string })[] {
  if (!thread) return [];

  // Debug the thread structure
  console.log("Thread structure:", thread);

  // Create a flat array of all messages with parent references
  const flattenedMessages: (Message & { parentId?: string })[] = [];

  // Helper function to flatten the message tree
  const flattenMessageTree = (messages: any[], parentId?: string) => {
    messages.forEach((msg) => {
      flattenedMessages.push({
        content: msg.text,
        role: msg.role as "user" | "assistant",
        id: msg.id,
        parentId: msg.parentMessageId || parentId, // Use explicit parentMessageId or the parent we're traversing from
        createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        reasoning: msg.reasoning,
        experimental_attachments: msg.attachments?.map((attachment: any) => ({
          name: attachment.fileName,
          url: attachment.url,
          file_key: attachment.fileKey,
          contentType: attachment.mimeType,
        })),
        toolInvocations: msg.toolCalls?.map((toolCall: any) => ({
          id: toolCall.id,
          toolName: toolCall.toolName,
          status: toolCall.status,
          result: toolCall.result,
          args: toolCall.args,
          toolCallId: toolCall.toolCallId,
          state: "result" as const,
        })),
      });

      // Process children recursively, passing current message as parent
      if (msg.children?.length) {
        flattenMessageTree(msg.children, msg.id);
      }
    });
  };

  // Start flattening from root messages
  flattenMessageTree(thread?.messages || []);

  // Sort by creation date to ensure chronological order
  flattenedMessages.sort((a, b) => {
    return (
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime()
    );
  });

  console.log("Flattened messages with parent IDs:", flattenedMessages);

  return flattenedMessages;
}
