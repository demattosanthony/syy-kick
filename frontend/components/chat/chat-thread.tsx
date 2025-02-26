"use client";

import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

// Types
import { Attachment, Message } from "@ai-sdk/ui-utils";

// Atoms
import {
  initalInputAtom,
  instructionsAtom,
  modelAtom,
  selectedArtifactAtom,
  selectedProjectDocsAtom,
  temperatureAtom,
  uploadsAtom,
} from "@/atoms/chat";

// Hooks
import { useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { useAtom } from "jotai";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Components
import ChatInputForm from "@/components/chat/ChatInputForm";
import ChatMessagesList from "@/components/chat/MessagesList";
import { Thread } from "@/types/chat";
import { toast } from "sonner";
import { useWorkspace } from "../sidebar/workspace-context";
import MarkdownEditorViewer from "../viewers/markdown-viewer";
import { Button } from "../ui/button";
import { Copy, X } from "lucide-react";
import { cn, scrollbarStyle } from "@/lib/utils";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage({
  initalMessages,
  thread,
}: {
  initalMessages: Message[];
  thread?: Thread;
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
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);

  const [selectedProjectDocs, setSelectedProjectDocs] = useAtom(
    selectedProjectDocsAtom
  );

  const { activeWorkspace } = useWorkspace();
  const orgId =
    activeWorkspace?.type === "organization" ? activeWorkspace.id : undefined;

  const {
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    messages,
    status,
    stop,
    error,
  } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/threads/${threadId}/inference`,
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
        organizationId: orgId,
      };
    },
  });

  async function processAttachments() {
    const attachments: ExtendedAttachment[] = [];

    // Process uploads
    if (uploads.length > 0) {
      const uploadAttachments = await Promise.all(
        uploads.map(async (upload) => {
          const { url, file_metadata, viewUrl } =
            await api.uploads.getPresignedUrl(
              upload.file.name,
              upload.file.type,
              upload.file.size,
              `uploads/${Date.now()}-${upload.file.name}`
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

      attachments.push(...uploadAttachments);
    }

    // Process selected project docs
    if (selectedProjectDocs.length > 0) {
      const docAttachments: ExtendedAttachment[] = selectedProjectDocs
        .filter((doc): doc is typeof doc & { url: string; fileKey: string } =>
          Boolean(doc.url && doc.fileKey)
        )
        .map((doc) => ({
          name: doc.name,
          contentType: doc.mimeType,
          url: doc.url,
          file_key: doc.fileKey,
        }));

      attachments.push(...docAttachments);
    }

    return attachments;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const attachments = await processAttachments();

    handleSubmit(e, {
      experimental_attachments: attachments,
    });

    // Reset attachments after submit
    setUploads([]);
    setSelectedProjectDocs([]);
  }

  useEffect(() => {
    // If its a new thread, send the message right away
    if (isNew) {
      onSubmit({ preventDefault: () => {} } as React.FormEvent);
      router.replace(`/threads/${threadId}`);
      setInitalInput("");

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["threads"] }); // Needed so the app sidebar shows the new thread
        queryClient.invalidateQueries({ queryKey: ["thread", threadId] }); // Needed so the thread page shows the new thread
      }, 2000);

      return;
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setInitalInput("");
      setSelectedArtifact(null);
    };
  }, [threadId]);

  useEffect(() => {
    if (error) {
      toast.error("An error occurred. Please try again later.");
    }
  }, [error]);

  // Add state for managing the split width
  const [splitPosition, setSplitPosition] = useState(35);
  const [isResizing, setIsResizing] = useState(false);

  // Handle mouse down on the resizer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.getElementById("chat-container");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newPosition =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Limit the resize range (10% to 90%)
      const limitedPosition = Math.min(Math.max(newPosition, 10), 90);
      setSplitPosition(limitedPosition);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <>
      <div id="chat-container" className="flex h-full w-full relative">
        <div
          className="flex flex-col h-full min-w-[300px]"
          style={{
            width: selectedArtifact ? `${splitPosition}%` : "100%",
          }}
        >
          <div className="flex-1 ">
            <ChatMessagesList
              messages={messages}
              isLoading={status === "submitted"}
            />
          </div>

          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <ChatInputForm
              input={input}
              setInput={setInput}
              handleInputChange={handleInputChange}
              onSubmit={onSubmit}
              stop={stop}
              isGenerating={status === "streaming"}
              showContextSelector={thread?.project !== null}
              projectId={thread?.project?.id}
            />
          </div>
        </div>

        {selectedArtifact && (
          <>
            {/* Resizable border */}
            <div
              className="w-[2px] hover:w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors bg-gray-200"
              onMouseDown={handleMouseDown}
            />

            <AnimatePresence>
              <motion.div
                className="h-full"
                style={{ width: `${100 - splitPosition - 0.25}%` }}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <div className="flex-1 w-full h-full relative shadow-md">
                  <div
                    className={cn(
                      "absolute inset-0 overflow-y-auto",
                      scrollbarStyle
                    )}
                  >
                    <div className="mx-auto">
                      {/* Header with artifact name and copy button */}
                      <div className="flex justify-between items-center sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-3 border-b">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setSelectedArtifact(null)}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <h3 className="text-lg font-medium truncate max-w-[400px]">
                            {selectedArtifact.title || "Untitled Artifact"}
                          </h3>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                selectedArtifact.content
                              );
                              toast.success("Content copied to clipboard");
                            }}
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 px-6">
                        <MarkdownEditorViewer
                          initialContent={selectedArtifact.content}
                          editable
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </>
  );
}
