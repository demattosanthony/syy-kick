"use client";

import api from "@/lib/api";

// Types
import { Attachment, Message } from "@ai-sdk/ui-utils";

// Atoms
import {
  alreadyAutoSelectedArtifactAtom,
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
import { useEffect, useMemo, useState } from "react";

// Components
import { Thread } from "@/types/chat";
import { toast } from "sonner";
import ThreadHeader from "./thread-header";
import { useResizeLayout } from "../hooks";
import {
  ArtifactViewer,
  ChatInputForm,
  ChatMessagesList,
} from "@/features/chat/messages/components";
import { CloneThreadButton } from "./clone-thread-button";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage({
  initalMessages,
  thread,
  viewOnly = false,
  messagesAreBeingFetched = false,
  showCloneThreadButton = false,
}: {
  initalMessages: Message[];
  thread?: Thread;
  viewOnly?: boolean;
  messagesAreBeingFetched?: boolean;
  showCloneThreadButton?: boolean;
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
  const [, setAlreadyOpenedArtifact] = useAtom(alreadyAutoSelectedArtifactAtom);
  const [selectedProjectDocs, setSelectedProjectDocs] = useAtom(
    selectedProjectDocsAtom
  );

  // Find all root user messages
  const rootUserMessages = useMemo(() => {
    return initalMessages.filter(
      (msg) => msg.role === "user" && !(msg as any).parentId
    );
  }, [initalMessages]);

  // Set the active branch to the most recent root user message by default
  const [activeBranchMessageId, setActiveBranchMessageId] = useState<
    string | undefined
  >(() => {
    if (rootUserMessages.length > 1) {
      // Sort by creation date and get the most recent
      const sortedMessages = [...rootUserMessages].sort((a, b) => {
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
      return sortedMessages[0].id;
    }
    return undefined; // Only set a default if there are multiple branches
  });

  // Get the last message id based on the active branch
  const lastMessageId = useMemo(() => {
    if (!activeBranchMessageId) {
      // If no active branch, use the last message in the initial messages
      return initalMessages.length > 0
        ? initalMessages[initalMessages.length - 1].id
        : undefined;
    }

    // Find the last message in the active branch
    const messagesInBranch = new Set<string>();
    const messagesToProcess = [activeBranchMessageId];

    // Add the active branch message
    messagesInBranch.add(activeBranchMessageId);

    // Add all descendants (children)
    while (messagesToProcess.length > 0) {
      const currentId = messagesToProcess.shift()!;

      // Find all direct children
      const children = initalMessages.filter(
        (msg) => (msg as any).parentId === currentId
      );

      // Add them to the set and queue
      children.forEach((child) => {
        messagesInBranch.add(child.id);
        messagesToProcess.push(child.id);
      });
    }

    // Find the most recent message in the branch
    const branchMessages = initalMessages.filter((msg) =>
      messagesInBranch.has(msg.id)
    );
    const sortedBranchMessages = [...branchMessages].sort((a, b) => {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    });

    return sortedBranchMessages.length > 0
      ? sortedBranchMessages[0].id
      : activeBranchMessageId;
  }, [initalMessages, activeBranchMessageId]);

  // Handle branch selection
  const handleBranchSelect = (messageId: string) => {
    console.log("Selected branch:", messageId);
    setActiveBranchMessageId(messageId);

    // Optional: You could also scroll to the selected branch
    setTimeout(() => {
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

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
        parentMessageId: lastMessageId,
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

  const handleEditComplete = async (editedMessage: Message) => {
    console.log("Edit complete:", editedMessage);
    // Set the input to empty since we're auto-submitting
    setInput("");

    onSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

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
      setAlreadyOpenedArtifact(null);
    };
  }, [threadId]);

  useEffect(() => {
    if (error) {
      toast.error("An error occurred. Please try again later.");
    }
  }, [error]);

  const { splitPosition, handleMouseDown } = useResizeLayout();

  console.log(thread);

  return (
    <div id="chat-container" className="flex h-full w-full relative">
      {selectedArtifact && (
        <>
          <ArtifactViewer
            artifact={selectedArtifact}
            splitPosition={splitPosition}
            messages={messages}
          />

          {/* Resizable border */}
          <div
            className="w-[2px] hover:w-1 h-full cursor-col-resize bg-secondary transition-all"
            onMouseDown={handleMouseDown}
          />
        </>
      )}

      <div
        className="flex flex-col h-full min-w-[400px] relative"
        style={{
          width: selectedArtifact ? `${splitPosition}%` : "100%",
        }}
      >
        <ThreadHeader />
        <div className="flex-1">
          <ChatMessagesList
            messages={messages}
            isLoading={status === "submitted"}
            threadId={threadId}
            showSkeletons={messagesAreBeingFetched}
            onSelectBranch={handleBranchSelect}
            activeBranchMessageId={activeBranchMessageId}
            onEditComplete={handleEditComplete}
          />
        </div>

        {!viewOnly && (
          <div className="w-full flex flex-col items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            {activeBranchMessageId && (
              <div className="w-full mb-2 text-center">
                <div className="text-xs text-muted-foreground flex items-center justify-center">
                  <GitBranch className="h-3 w-3 mr-1" />
                  Replying to a specific branch
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs p-0 h-auto ml-1"
                    onClick={() => setActiveBranchMessageId(undefined)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
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
        )}

        {showCloneThreadButton && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <CloneThreadButton threadId={threadId} />
          </div>
        )}
      </div>
    </div>
  );
}
