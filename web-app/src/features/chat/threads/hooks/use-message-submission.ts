import { useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { ChatMessage, MessageRole } from "@/types/chat";
import { chatStatusAtom, modelAtom, instructionsAtom } from "@/atoms/chat";
import api from "@/lib/api";
import { useAttachmentProcessing } from "./use-attachment-processing";

interface UseMessageSubmissionProps {
  threadId?: string;
  onMessageAdd: (message: ChatMessage) => void;
  onError: (error: string | null) => void;
}

export function useMessageSubmission({
  threadId,
  onMessageAdd,
  onError,
}: UseMessageSubmissionProps) {
  const [chatStatus, setChatStatus] = useAtom(chatStatusAtom);
  const [model] = useAtom(modelAtom);
  const [instructions] = useAtom(instructionsAtom);
  const { processAttachments, clearAttachments } = useAttachmentProcessing();

  const abortControllerRef = useRef<AbortController | null>(null);

  const createUserMessage = useCallback((input: string, attachments: any[]) => {
    return {
      id: crypto.randomUUID(),
      role: MessageRole.user,
      text: input,
      createdAt: new Date().toISOString(),
      attachments: attachments.map((att) => ({
        id: crypto.randomUUID(),
        messageId: "",
        fileName: att.name,
        mimeType: att.contentType,
        fileKey: att.file_key,
        url: att.url,
        type: (att.contentType?.includes("image") ? "image" : "file") as
          | "image"
          | "file",
        size: undefined,
        markdown: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      toolCalls: [],
    };
  }, []);

  const submitMessage = useCallback(
    async (input: string) => {
      if (
        !input.trim() ||
        chatStatus === "submitted" ||
        chatStatus === "streaming" ||
        !threadId
      ) {
        return false;
      }

      try {
        onError(null);
        setChatStatus("submitted");

        abortControllerRef.current = new AbortController();
        const attachments = await processAttachments();

        const userMessage = createUserMessage(input, attachments);
        onMessageAdd(userMessage);

        await api.threads.postMessage({
          threadId,
          message: {
            content: input,
            role: MessageRole.user,
            experimental_attachments: attachments,
          },
          model: model.name,
          maxTokens: undefined,
          instructions: instructions || undefined,
        });

        clearAttachments();
        return true;
      } catch (error) {
        console.error("Error posting message:", error);
        onError("Failed to send message. Please try again.");
        setChatStatus("ready");
        return false;
      }
    },
    [
      chatStatus,
      threadId,
      processAttachments,
      createUserMessage,
      onMessageAdd,
      model.name,
      instructions,
      clearAttachments,
      onError,
      setChatStatus,
    ]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setChatStatus("ready");
  }, [setChatStatus]);

  return {
    submitMessage,
    stop,
    isSubmitting: chatStatus === "submitted" || chatStatus === "streaming",
  };
}
