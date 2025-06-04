import api from "@/lib/api";

// Types
import { Attachment } from "@ai-sdk/ui-utils";
import { ChatMessage, MessageRole } from "@/types/chat";

// Atoms
import {
  alreadyAutoSelectedArtifactAtom,
  initalInputAtom,
  instructionsAtom,
  modelAtom,
  selectedArtifactAtom,
  selectedProjectDocsAtom,
  uploadsAtom,
  chatStatusAtom,
} from "@/atoms/chat";

// Hooks
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useParams, useNavigate } from "react-router";
import { useEffect, useState, useRef, useCallback } from "react";

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

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export default function ThreadPage({
  initalMessages,
  thread,
  viewOnly = false,
  messagesAreBeingFetched = false,
  showCloneThreadButton = false,
  isNew = false,
}: {
  initalMessages: ChatMessage[];
  thread?: Thread;
  viewOnly?: boolean;
  messagesAreBeingFetched?: boolean;
  showCloneThreadButton?: boolean;
  isNew?: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const [model] = useAtom(modelAtom);
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [instructions] = useAtom(instructionsAtom);
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const [, setAlreadyOpenedArtifact] = useAtom(alreadyAutoSelectedArtifactAtom);
  const [selectedProjectDocs, setSelectedProjectDocs] = useAtom(
    selectedProjectDocsAtom
  );
  const [chatStatus, setChatStatus] = useAtom(chatStatusAtom);

  // Local state for messages and error
  const [messages, setMessages] = useState<ChatMessage[]>(initalMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // EventSource ref
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Add connection state tracking
  const isConnectingRef = useRef<boolean>(false);

  // Convert ChatMessage to Message format for compatibility
  const convertedMessages = messages.map((msg) => ({
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setChatStatus("ready");
  }, [setChatStatus]);

  // Initialize EventSource connection
  const connectToStream = useCallback(() => {
    // Prevent multiple connections
    if (!threadId || eventSourceRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;

    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/threads/${threadId}/stream`,
      { withCredentials: true }
    );

    eventSource.onopen = () => {
      console.log("EventSource connection opened for thread:", threadId);
      isConnectingRef.current = false;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("SSE data received:", data);

        if (data.type === "connected") {
          console.log("Connected to message stream");
        } else if (data.type === "heartbeat") {
          // Keep-alive, do nothing
        } else if (data.type === "stream-resume") {
          // console.log("Stream resume event:", data);
          setMessages((prev) => {
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.messageId
            );
            if (existingMessageIndex !== -1) {
              // Update existing message
              return prev.map((msg, index) =>
                index === existingMessageIndex
                  ? {
                      ...msg,
                      text: data.fullText,
                      createdAt: data.createdAt || msg.createdAt, // Use new createdAt if available
                      role: data.role || msg.role, // Use new role if available
                    }
                  : msg
              );
            } else {
              // Add as a new message if it doesn't exist (edge case)
              const newMessage: ChatMessage = {
                id: data.messageId,
                role: data.role as MessageRole,
                text: data.fullText,
                createdAt: data.createdAt || new Date().toISOString(),
                attachments: [], // Assuming no attachments for resumed message initially
                toolCalls: [], // Assuming no tool calls for resumed message initially
              };
              return [...prev, newMessage];
            }
          });
          setChatStatus("streaming"); // Or ready, depending on if more deltas are expected immediately
        } else if (data.type === "text-delta") {
          setChatStatus("streaming");
          setMessages((prev) => {
            const targetMessageId = data.messageId; // Server should send this for text-deltas too
            const isInitialChunk = data.isInitialChunk;

            // Try to find the message by ID
            let messageExists = prev.some((msg) => msg.id === targetMessageId);

            if (targetMessageId && messageExists) {
              return prev.map((msg) =>
                msg.id === targetMessageId
                  ? { ...msg, text: (msg.text || "") + data.content }
                  : msg
              );
            } else if (targetMessageId && isInitialChunk) {
              // Create a new assistant message for streaming if it's an initial chunk and ID provided
              const newMessage: ChatMessage = {
                id: targetMessageId,
                role: (data.role as MessageRole) || MessageRole.assistant, // Use role from data or default
                text: data.content,
                createdAt: data.createdAt || new Date().toISOString(), // Use createdAt from data or now
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            } else if (!targetMessageId && prev.length > 0) {
              // Fallback: If no messageId, append to the last assistant message if it's streaming
              const lastMessage = prev[prev.length - 1];
              if (
                lastMessage &&
                lastMessage.role === MessageRole.assistant &&
                lastMessage.text !== null
              ) {
                return prev.map((msg, index) =>
                  index === prev.length - 1
                    ? { ...msg, text: (msg.text || "") + data.content }
                    : msg
                );
              } else {
                // Fallback: Create a new assistant message if last one isn't suitable
                const newMessage: ChatMessage = {
                  id: crypto.randomUUID(), // Or data.messageId if available and makes sense here
                  role: MessageRole.assistant,
                  text: data.content,
                  createdAt: new Date().toISOString(),
                  attachments: [],
                  toolCalls: [],
                };
                return [...prev, newMessage];
              }
            } else {
              // Fallback: if no targetMessageId and no previous messages, create a new one.
              // This case should be rare with the new server logic.
              const newMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: MessageRole.assistant,
                text: data.content,
                createdAt: new Date().toISOString(),
                attachments: [],
                toolCalls: [],
              };
              return [...prev, newMessage];
            }
          });
        } else if (data.type === "message-complete") {
          // console.log("Message complete event:", data);
          setMessages((prev) => {
            // Replace the message with the complete one from the server
            // This ensures all fields (text, toolCalls, attachments if any) are up-to-date
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.message.id
            );
            if (existingMessageIndex !== -1) {
              return prev.map((msg, index) =>
                index === existingMessageIndex ? data.message : msg
              );
            } else {
              // If message doesn't exist, add it (should be rare if streaming was handled)
              return [...prev, data.message];
            }
          });
          setChatStatus("ready");
        } else if (data.type === "tool-call") {
          // console.log("Tool call event:", data);
          // The `data.message` here IS the assistant message that contains the tool calls
          setMessages((prev) => {
            const existingMessageIndex = prev.findIndex(
              (msg) => msg.id === data.message.id
            );
            if (existingMessageIndex !== -1) {
              // Replace the existing message with the one from the event, which includes tool_calls
              return prev.map((msg, index) =>
                index === existingMessageIndex ? data.message : msg
              );
            } else {
              // If for some reason this assistant message isn't in state, add it.
              return [...prev, data.message];
            }
          });
          // setChatStatus might depend on whether further text is expected after tool use
        } else if (data.type === "message-error") {
          console.error("Message error event from server:", data.error);
          toast.error(data.error || "Error processing message on server.");
          setMessages((prev) => {
            if (data.message && data.message.id) {
              const existingMessageIndex = prev.findIndex(
                (msg) => msg.id === data.message.id
              );
              if (existingMessageIndex !== -1) {
                return prev.map((msg, index) =>
                  index === existingMessageIndex
                    ? {
                        ...data.message,
                        text:
                          data.message.text +
                          `\n[SERVER ERROR: ${data.error || "Unknown"}]`,
                      }
                    : msg
                );
              } else {
                return [
                  ...prev,
                  {
                    ...data.message,
                    text:
                      data.message.text +
                      `\n[SERVER ERROR: ${data.error || "Unknown"}]`,
                  },
                ];
              }
            } // else, just show toast, no specific message to update.
            return prev;
          });
          setChatStatus("ready");
        }
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      setError("Connection to message stream lost. Please refresh.");
      setChatStatus("ready");
      isConnectingRef.current = false;
      // No need to close here, onerror implies it's already in a failed state or closed.
    };

    eventSourceRef.current = eventSource;
  }, [threadId, setChatStatus]); // Added setChatStatus

  // Disconnect from EventSource
  const disconnectFromStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("Disconnected from message stream for thread:", threadId);
    }
    isConnectingRef.current = false;
  }, [threadId]);

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

    if (
      !input.trim() ||
      chatStatus === "submitted" ||
      chatStatus === "streaming" ||
      !threadId
    )
      return;

    try {
      setError(null);
      setChatStatus("submitted");

      abortControllerRef.current = new AbortController();
      const attachments = await processAttachments();

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: MessageRole.user,
        text: input,
        createdAt: new Date().toISOString(),
        attachments: attachments.map((att) => ({
          id: crypto.randomUUID(),
          messageId: "", // Will be set by backend if needed, or link to userMessage.id client-side
          fileName: att.name,
          mimeType: att.contentType,
          fileKey: att.file_key,
          url: att.url,
          type: att.contentType?.includes("image") ? "image" : "file",
          size: undefined,
          markdown: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMessage]);

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

      setInput("");
      setUploads([]);
      setSelectedProjectDocs([]);
      // Chat status will be updated by SSE events (streaming, then ready on complete)
    } catch (error) {
      console.error("Error posting message:", error);
      setError("Failed to send message. Please try again.");
      setChatStatus("ready"); // Reset status on error
    }
  }

  // Initialize EventSource on mount and when threadId changes
  useEffect(() => {
    if (messagesAreBeingFetched) {
      disconnectFromStream();
      setChatStatus("ready");
      return;
    }

    // Simply connect if we have a threadId and we're not in view-only mode
    if (threadId && !viewOnly && !isNew) {
      connectToStream();
    }

    return () => {
      disconnectFromStream();
    };
  }, [
    threadId,
    viewOnly,
    messagesAreBeingFetched,
    isNew,
    connectToStream,
    disconnectFromStream,
  ]);

  // Update messages when initialMessages change (e.g., after first load) -
  useEffect(() => {
    setMessages(initalMessages);
  }, [initalMessages]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setInitalInput("");
      setSelectedArtifact(null);
      setAlreadyOpenedArtifact(null);
      setChatStatus("ready");
      disconnectFromStream();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    threadId,
    disconnectFromStream,
    setChatStatus,
    setInitalInput,
    setSelectedArtifact,
    setAlreadyOpenedArtifact,
  ]);

  const { splitPosition, handleMouseDown } = useResizeLayout();

  return (
    <div id="chat-container" className="flex h-full w-full relative">
      {selectedArtifact && (
        <>
          <ArtifactViewer
            artifact={selectedArtifact}
            splitPosition={splitPosition}
            messages={convertedMessages}
          />
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
        {thread && <ThreadHeader />}

        <div className="flex-1">
          <ChatMessagesList
            messages={convertedMessages}
            status={chatStatus}
            showSkeletons={messagesAreBeingFetched}
          />
        </div>

        {!viewOnly && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <ChatInputForm
              input={input}
              setInput={setInput}
              handleInputChange={handleInputChange}
              onSubmit={onSubmit}
              stop={stop}
              isGenerating={
                chatStatus === "submitted" || chatStatus === "streaming"
              }
              hasThread={true}
            />
          </div>
        )}

        {showCloneThreadButton && (
          <div className="w-full flex items-center justify-center mx-auto px-6 pb-8 md:pb-4 md:p-2">
            <CloneThreadButton threadId={threadId as string} />
          </div>
        )}
      </div>
    </div>
  );
}
