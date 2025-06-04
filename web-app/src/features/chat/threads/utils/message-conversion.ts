import { ChatMessage } from "@/types/chat";
import { Message } from "ai";

export function convertChatMessagesToMessages(
  messages: ChatMessage[]
): Message[] {
  return messages.map((msg) => {
    const parts: any[] = [];

    // Add reasoning part first if it exists (thinking always comes first)
    if (msg.reasoning) {
      parts.push({
        type: "reasoning",
        reasoning: msg.reasoning,
      });
    }

    // Add text part (AI typically generates text before deciding to use tools)
    if (msg.text) {
      parts.push({
        type: "text",
        text: msg.text,
      });
    }

    // Add tool invocation parts last (tools are used after generating text)
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
