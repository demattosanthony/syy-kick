import { ChatMessage } from "@/types/chat";
import { Message } from "ai";

export function convertChatMessagesToMessages(
  messages: ChatMessage[]
): Message[] {
  return messages.map((msg) => {
    // Create parts array in the proper order
    const parts: any[] = [];

    // Add reasoning part first if it exists
    if (msg.reasoning) {
      parts.push({
        type: "reasoning",
        reasoning: msg.reasoning,
      });
    }

    // Add tool invocation parts
    if (msg.toolCalls?.length) {
      msg.toolCalls.forEach((toolCall) => {
        parts.push({
          type: "tool-invocation",
          toolInvocation: {
            id: toolCall.id,
            toolName: toolCall.toolName,
            status: toolCall.status,
            result: toolCall.result,
            args: toolCall.args,
            toolCallId: toolCall.toolCallId,
            state: "result" as const,
          },
        });
      });
    }

    // Add text part if it exists
    if (msg.text) {
      parts.push({
        type: "text",
        text: msg.text,
      });
    }

    return {
      id: msg.id,
      role: (msg.role === "tool" ? "data" : msg.role) as
        | "user"
        | "assistant"
        | "system"
        | "data",
      content: msg.text || "",
      createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
      parts: parts.length > 0 ? parts : undefined,
      toolInvocations: msg.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        toolName: toolCall.toolName,
        status: toolCall.status,
        result: toolCall.result,
        args: toolCall.args,
        toolCallId: toolCall.toolCallId,
        state: "result" as const,
      })),
      experimental_attachments:
        msg.attachments?.map((att) => ({
          name: att.fileName,
          contentType: att.mimeType,
          url: att.url,
        })) || [],
    } as Message;
  });
}
