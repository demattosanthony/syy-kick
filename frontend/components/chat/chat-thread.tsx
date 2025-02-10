"use client";

import api from "@/lib/api";

// Types
import { Attachment, Message } from "@ai-sdk/ui-utils";

// Atoms
import {
  initalInputAtom,
  instructionsAtom,
  modelAtom,
  temperatureAtom,
  uploadsAtom,
} from "@/atoms/chat";

// Hooks
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "ai/react";
import { useAtom } from "jotai";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Components
import ChatInputForm from "@/components/chat/ChatInputForm";
import ChatMessagesList from "@/components/chat/MessagesList";
import { useWorkspace } from "../sidebar/workspace-context";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage({
  initalMessages,
}: {
  initalMessages: Message[];
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "true";
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const [model] = useAtom(modelAtom);
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [temperature] = useAtom(temperatureAtom);
  const [instructions] = useAtom(instructionsAtom);

  const { activeWorkspace } = useWorkspace();

  const {
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    messages,
    isLoading,
    stop,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/threads/${threadId}/inference${
      activeWorkspace?.type === "organization"
        ? `?organizationId=${activeWorkspace.id}`
        : ""
    }`,
    credentials: "include",
    initialInput: isNew ? initalInput : "",
    initialMessages: initalMessages,
    experimental_prepareRequestBody({ messages, id }) {
      return {
        message: messages[messages.length - 1],
        id,
        model: model.name,
        temperature: temperature,
        instructions,
      };
    },
  });

  async function processAttachments() {
    // Process uploads
    if (uploads.length > 0) {
      const attachments: ExtendedAttachment[] = await Promise.all(
        uploads.map(async (upload) => {
          const { url, file_metadata, viewUrl } =
            await api.uploads.getPresignedUrl(
              upload.file.name,
              upload.file.type,
              upload.file.size
            );

          // upload directly to storage
          await fetch(url, {
            method: "PUT",
            body: upload.file,
            headers: {
              "Content-Type": upload.file.type,
            },
          });

          const attachment: ExtendedAttachment = {
            name: upload.file.name,
            contentType: upload.file.type,
            url: viewUrl,
            file_key: file_metadata.file_key,
          };

          return attachment;
        })
      );

      return attachments;
    }
    return [];
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const attachments = await processAttachments();

    handleSubmit(e, {
      experimental_attachments: attachments,
    });

    // Reset attachments after submit
    setUploads([]);
  }

  useEffect(() => {
    // If its a new thread, send the message right away
    if (isNew) {
      onSubmit({ preventDefault: () => {} } as React.FormEvent);
      router.replace(`/threads/${threadId}`);
      setInitalInput("");

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["threads"] }); // Needed so the app sidebar shows the new thread
      }, 2000);

      return;
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setInitalInput("");
    };
  }, [threadId]);

  return (
    <>
      <ChatMessagesList messages={messages} isLoading={isLoading} />

      <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
        <ChatInputForm
          input={input}
          setInput={setInput}
          handleInputChange={handleInputChange}
          onSubmit={onSubmit}
          stop={stop}
          isGenerating={isLoading}
        />
      </div>
    </>
  );
}
