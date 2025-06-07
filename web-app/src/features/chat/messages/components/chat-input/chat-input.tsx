import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { modelAtom, uploadsAtom } from "@/atoms/chat";
import { FileUploadSection } from "./file-upload-section";
import { TextInputArea } from "./chat-input-text-area";
import { ActionButtons } from "./action-buttons";
import { ContextSelector } from "./context-selector";

interface ChatInputFormProps {
  onSubmit: (e: React.FormEvent) => void;
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  isGenerating?: boolean;
  stop?: () => void;
  hasThread?: boolean;
}

export interface ChatInputFormRef {
  triggerFileInput: () => void;
  focusTextArea: () => void;
}

function ChatInputForm(
  {
    onSubmit,
    input,
    setInput,
    handleInputChange,
    placeholder = "How can I help you today?",
    isGenerating,
    stop,
    hasThread,
  }: ChatInputFormProps,
  ref: React.ForwardedRef<ChatInputFormRef>
) {
  const isMobile = useIsMobile();
  const [focused, setFocused] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel] = useAtom(modelAtom);
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const {
    handleFiles,
    removeUpload,
    handleDrop,
    processFiles,
    processFileUpload,
    isProcessing,
    hasErrors,
    isReadyToSubmit,
  } = useFileUpload(selectedModel.supportedMimeTypes || []);

  React.useImperativeHandle(ref, () => ({
    triggerFileInput: () => fileInputRef.current?.click(),
    focusTextArea: () => textAreaRef.current?.focus(),
  }));

  const handleFileUploadComplete = () => {
    textAreaRef.current?.focus();
  };

  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      const caretPosition = (event.target as HTMLTextAreaElement)
        .selectionStart;
      const textBeforeCaret = input.substring(0, caretPosition);
      const textAfterCaret = input.substring(caretPosition);
      setInput(textBeforeCaret + "\n" + textAfterCaret);
      setTimeout(() => {
        if (textAreaRef?.current) {
          textAreaRef.current.selectionStart = caretPosition + 1;
          textAreaRef.current.selectionEnd = caretPosition + 1;
        }
      }, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();

      // Don't submit if files are still processing
      if (isProcessing) {
        return;
      }

      onSubmit(event);
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (selectedModel.supportedMimeTypes?.length) {
      setIsDragging(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (selectedModel.supportedMimeTypes?.length) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Check if the mouse is leaving the container entirely
    // by checking if the relatedTarget (what the mouse is moving to)
    // is not contained within the card
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleDrop(e);
  };

  // Handle form submission with file processing check
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Don't submit if files are still processing
    if (isProcessing) {
      return;
    }

    onSubmit(e);
  };

  useEffect(() => {
    if (textAreaRef?.current) {
      textAreaRef.current.style.height = "24px";
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!isGenerating) textAreaRef?.current?.focus();
  }, [isGenerating]);

  return (
    <div className="relative flex flex-col items-center w-full">
      <Card
        ref={cardRef}
        className={cn(
          "relative flex flex-col h-auto min-h-[130px] max-h-[600px] w-full mx-auto max-w-[640px] p-0 rounded-3xl border shadow-sm",
          focused && !isMobile && "border-border border-[1.5px]",
          isDragging && "border-border border-[1.5px]",
          hasThread && "min-h-[130px]",
          !!hasThread && "min-h-[145px]"
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
        onDrop={handleCardDrop}
      >
        <form
          className="relative flex flex-col flex-1 w-full justify-center p-2"
          onSubmit={handleFormSubmit}
        >
          <ContextSelector
            showContextSelector={!!hasThread}
            selectedModel={selectedModel}
          />
          <div className="flex flex-col flex-1 relative">
            {/* Drag message section above the input */}
            {isDragging && (
              <div className="mb-2 w-full max-w-[640px] flex items-center justify-center border-2 border-dashed border-border rounded-lg py-4 bg-accent transition-all duration-200">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Drop files here to add to your message.
                </span>
              </div>
            )}

            <FileUploadSection uploads={uploads} removeUpload={removeUpload} />

            {/* Error status message */}
            {hasErrors && (
              <div className="px-2 pb-2">
                <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                  Some files failed to process. Remove them or try uploading
                  again.
                </div>
              </div>
            )}

            <div className="min-h-[65px]">
              <TextInputArea
                input={input}
                handleInputChange={handleInputChange}
                handleKeyDown={handleKeyDown}
                placeholder={placeholder}
                isGenerating={isGenerating}
                textAreaRef={textAreaRef}
                setFocused={setFocused}
                processFiles={processFiles}
              />
            </div>
          </div>
          <ActionButtons
            isGenerating={isGenerating}
            input={input}
            stop={stop}
            onSubmit={handleFormSubmit}
            selectedModel={selectedModel}
            fileInputRef={fileInputRef}
            handleFiles={handleFiles}
            processFileUpload={processFileUpload}
            onFileUploadComplete={handleFileUploadComplete}
            showSharePointPopoverButton={false}
            isReadyToSubmit={isReadyToSubmit}
          />
        </form>
      </Card>
    </div>
  );
}

export default React.forwardRef<ChatInputFormRef, ChatInputFormProps>(
  ChatInputForm
);
