import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFileUpload } from "@/hooks/use-file-upload";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { modelAtom } from "@/atoms/chat";
import { FileUploadSection } from "./file-upload-section";
import { ContextSelector } from "./context-selector";
import { TextInputArea } from "./chat-input-text-area";
import { ActionButtons } from "./action-buttons";

interface ChatInputFormProps {
  onSubmit: (e: React.FormEvent) => void;
  input: string;
  setInput: (input: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  isGenerating?: boolean;
  stop?: () => void;
  showContextSelector?: boolean;
  projectId?: string;
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
    placeholder = "What do you want to know?",
    isGenerating,
    stop,
    showContextSelector = false,
    projectId,
  }: ChatInputFormProps,
  ref: React.ForwardedRef<ChatInputFormRef>
) {
  const isMobile = useIsMobile();
  const [focused, setFocused] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedModel] = useAtom(modelAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { uploads, handleFiles, removeUpload, handleDrop, processFiles } =
    useFileUpload(selectedModel.supportedMimeTypes || []);

  React.useImperativeHandle(ref, () => ({
    triggerFileInput: () => fileInputRef.current?.click(),
    focusTextArea: () => textAreaRef.current?.focus(),
  }));

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
          "relative flex flex-col h-auto min-h-[102px] max-h-[600px] w-full mx-auto max-w-[640px] p-0 rounded-2xl bg-background border shadow-md transition-all",
          focused && !isMobile && "",
          isDragging && "border-border border-2 bg-background"
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragEnd={handleDragEnd}
        onDrop={handleCardDrop}
      >
        <form
          className="relative flex flex-col flex-1 w-full justify-center p-2"
          onSubmit={onSubmit}
        >
          <div className="flex flex-col flex-1 relative">
            {/* Drag message section above the input */}
            {isDragging && (
              <div className="mb-2 w-full max-w-[640px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg py-2 bg-gray-50 transition-all duration-200">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
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

            <ContextSelector
              showContextSelector={showContextSelector}
              projectId={projectId}
              selectedModel={selectedModel}
            />
            <FileUploadSection uploads={uploads} removeUpload={removeUpload} />
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
          <ActionButtons
            isGenerating={isGenerating}
            input={input}
            stop={stop}
            onSubmit={onSubmit}
            selectedModel={selectedModel}
            fileInputRef={fileInputRef}
            handleFiles={handleFiles}
          />
        </form>
      </Card>
    </div>
  );
}

export default React.forwardRef<ChatInputFormRef, ChatInputFormProps>(
  ChatInputForm
);
