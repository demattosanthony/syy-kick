"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  File,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflowQuery } from "../api";
import { Attachment } from "ai";
import api from "@/lib/api";
import { extractSpecialContent } from "@/lib/artifact-utils";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "@/features/chat/messages/components";
import { CsvViewer } from "@/features/chat/messages/components/viewers/artifact-viewer";
import { useCsvActions } from "@/hooks/use-csv-actions";
import { Loader } from "@/components/ui/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// #### Type Definitions
type ExtendedAttachment = Attachment & { file_key: string };

interface FileUploadInputProps {
  input: {
    id: string;
    title: string;
    description?: string;
    acceptedFileTypes?: string;
    required?: boolean;
  };
  file: File | null;
  onFileChange: (file: File | null) => void;
}

interface ProcessingIndicatorProps {
  reasoning?: string;
  showReasoning: boolean;
  onToggleReasoning: () => void;
}

interface OutputDisplayProps {
  response: any;
  outputConfig: any;
  status: string;
}

interface ErrorDisplayProps {
  errorDetails: {
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null;
  onReset: () => void;
}

/** FileUploadInput: Handles file selection for a single workflow input */
function FileUploadInput({
  input,
  file,
  onFileChange,
  setInput,
}: FileUploadInputProps & { setInput: (value: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      onFileChange(droppedFile);
      setInput(droppedFile.name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      onFileChange(selectedFile);
      setInput(selectedFile.name);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-2">{input.title}</h3>
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted hover:border-primary/50 hover:bg-muted/10"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() =>
          document.getElementById(`file-input-${input.id}`)?.click()
        }
      >
        <input
          type="file"
          id={`file-input-${input.id}`}
          className="hidden"
          accept={input.acceptedFileTypes}
          onChange={handleFileSelect}
        />
        <div className="text-center space-y-4">
          <div
            className={cn(
              "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
              file ? "bg-primary/10" : "bg-muted/30"
            )}
          >
            <File
              className={cn(
                "h-8 w-8",
                file ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="text-lg font-medium mb-1">
              {file ? file.name : "Drop your file here"}
            </p>
            <p className="text-sm text-muted-foreground">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · ${
                    file.type.includes("pdf")
                      ? "PDF"
                      : file.type.split("/")[1].toUpperCase()
                  }`
                : "or click to browse"}
            </p>
            {file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileChange(null);
                  const fileInput = document.getElementById(
                    `file-input-${input.id}`
                  ) as HTMLInputElement;
                  if (fileInput) fileInput.value = "";
                }}
                className="mt-3 text-sm text-primary hover:text-primary/80 font-medium flex items-center justify-center mx-auto"
              >
                <span className="mr-1">×</span> Remove file
              </button>
            )}
          </div>
        </div>
      </div>
      {input.required && (
        <p
          className={`text-xs mt-2 ${
            file ? "text-muted-foreground" : "text-red-500"
          }`}
        >
          {file ? "✓ Required file uploaded" : "* Required"}
        </p>
      )}
    </div>
  );
}

/** ProcessingIndicator: Displays loading state and reasoning during workflow execution */
function ProcessingIndicator({
  reasoning,
  showReasoning,
  onToggleReasoning,
}: ProcessingIndicatorProps) {
  const reasoningContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reasoningContainerRef.current && showReasoning && reasoning) {
      setTimeout(() => {
        if (reasoningContainerRef.current) {
          reasoningContainerRef.current.scrollTop =
            reasoningContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [reasoning, showReasoning]);

  return (
    <div className="bg-card rounded-xl p-8 shadow-lg border flex flex-col items-center justify-center">
      <Loader className="h-12 w-12 mb-4" variant="circular" />
      <h3 className="text-xl font-semibold mb-2">Processing your files</h3>
      <p className="text-muted-foreground text-center">
        Please wait while the workflow is running. This may take a few moments.
      </p>
      {reasoning && (
        <div className="mt-8 w-full">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-sm">Processing details</h4>
            <button
              onClick={onToggleReasoning}
              className="text-xs flex items-center text-muted-foreground hover:text-foreground"
            >
              {showReasoning ? (
                <>
                  Hide <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  Show <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </button>
          </div>
          {showReasoning && (
            <div
              ref={reasoningContainerRef}
              className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground overflow-y-auto max-h-[300px] font-mono whitespace-pre-wrap"
            >
              {reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** OutputDisplay: Renders the workflow output based on configuration */
function OutputDisplay({ response, outputConfig, status }: OutputDisplayProps) {
  const { downloadCsv, previewCsv } = useCsvActions();
  const { artifact } = extractSpecialContent(response?.content || "");

  if (!artifact?.content) return null;

  const isStreaming = status === "streaming";

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border">
      <div className="flex items-center gap-3 mb-6">
        {isStreaming ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold">Generating output...</h3>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
              <Check />
            </div>
            <h3 className="text-xl font-semibold">
              Run completed successfully
            </h3>
          </>
        )}
      </div>
      <div className="space-y-4">
        {outputConfig.type === "csv" || outputConfig.type === "table" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{outputConfig.title || "Results"}</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(artifact.content)}
                >
                  Download CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    previewCsv(
                      artifact.content,
                      outputConfig.title || "CSV Results"
                    )
                  }
                >
                  View Full Screen
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto border rounded">
              <div className="min-w-max">
                <CsvViewer content={artifact.content} />
              </div>
            </div>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <MarkdownViewer content={artifact.content} />
          </div>
        )}
      </div>
    </div>
  );
}

/** ErrorDisplay: Shows error messages with a reset option */
function ErrorDisplay({ errorDetails, onReset }: ErrorDisplayProps) {
  if (!errorDetails) return null;

  const errorIcons = {
    upload: <AlertCircle className="h-5 w-5 text-destructive" />,
    processing: <AlertCircle className="h-5 w-5 text-destructive" />,
    network: <AlertCircle className="h-5 w-5 text-destructive" />,
    general: <AlertCircle className="h-5 w-5 text-destructive" />,
  };

  const errorTitles = {
    upload: "File Upload Error",
    processing: "Processing Error",
    network: "Network Error",
    general: "Error",
  };

  return (
    <Alert variant="destructive" className="mb-8">
      <div className="flex items-start">
        {errorIcons[errorDetails.type]}
        <div className="ml-3">
          <AlertTitle>{errorTitles[errorDetails.type]}</AlertTitle>
          <AlertDescription className="mt-1">
            {errorDetails.message}
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reset and try again
          </Button>
        </div>
      </div>
    </Alert>
  );
}

// #### Main Component
export default function WorkflowPageContent({
  workflowId,
}: {
  workflowId: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [showReasoning, setShowReasoning] = useState(true);
  const [errorDetails, setErrorDetails] = useState<{
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null>(null);
  const hasAutoHiddenReasoning = useRef(false);

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId);
  const { handleSubmit, messages, setInput, status, setMessages } = useChat({
    api: `${process.env.NEXT_PUBLIC_API_URL}/workflows/${workflowId}/run`,
    credentials: "include",
    experimental_prepareRequestBody({ messages, id }) {
      return { message: messages[messages.length - 1], id };
    },
    onError: (error) => {
      console.error("Workflow error:", error);
      setErrorDetails({
        type:
          error.message.includes("network") || error.message.includes("fetch")
            ? "network"
            : error.message.includes("upload") || error.message.includes("file")
            ? "upload"
            : "processing",
        message:
          error.message || "An error occurred while processing your request.",
      });
    },
  });

  const isProcessing = status === "submitted" || messages.length > 0;
  const response = messages[1];

  // Initialize files state based on workflow inputs
  useEffect(() => {
    if (workflow?.inputs) {
      const initialFiles: Record<string, File | null> = {};
      workflow.inputs.forEach((input) => (initialFiles[input.id] = null));
      setFiles(initialFiles);
    }
  }, [workflow]);

  // Reset workflow state and reload page
  const resetWorkflow = () => {
    if (workflow?.inputs) {
      const resetFiles: Record<string, File | null> = {};
      workflow.inputs.forEach((input) => {
        resetFiles[input.id] = null;
        const fileInput = document.getElementById(
          `file-input-${input.id}`
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      });
      setFiles(resetFiles);
    }
    setInput("");
    setMessages([]);
    setErrorDetails(null);
    setShowReasoning(true);
    hasAutoHiddenReasoning.current = false;
    window.location.reload();
  };

  // Check if all required files are uploaded
  const areRequiredFilesUploaded = () => {
    if (!workflow?.inputs) return false;
    return workflow.inputs
      .filter((input) => input.required)
      .every((input) => files[input.id]);
  };

  // Handle form submission with file uploads
  const onSubmit = async () => {
    if (!areRequiredFilesUploaded()) return;

    try {
      const attachments: ExtendedAttachment[] = [];
      for (const inputId in files) {
        const file = files[inputId];
        if (!file) continue;
        const { url, file_metadata, viewUrl } =
          await api.uploads.getPresignedUrl(
            file.name,
            file.type,
            file.size,
            `uploads/${Date.now()}-${inputId}-${file.name}`
          );
        await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        attachments.push({
          name: file.name,
          contentType: file.type,
          url: viewUrl,
          file_key: file_metadata.file_key,
        });
      }
      const fileNames = Object.values(files)
        .filter(Boolean)
        .map((file) => file?.name)
        .join(", ");
      setInput(fileNames);
      handleSubmit({ preventDefault: () => {} } as React.FormEvent, {
        experimental_attachments: attachments,
      });
    } catch (err) {
      console.error("Submission error:", err);
      setErrorDetails({
        type: "general",
        message: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // Determine current step in the workflow process
  const getCurrentStep = () => {
    if (errorDetails) return 0;
    if (!areRequiredFilesUploaded()) return 1;
    if (isProcessing && (!response?.content || response?.content === ""))
      return 2;
    if (response) {
      if (showReasoning && !hasAutoHiddenReasoning.current) {
        setShowReasoning(false);
        hasAutoHiddenReasoning.current = true;
      }
      return 3;
    }
    return 1;
  };

  const currentStep = getCurrentStep();
  const workflowInputs = workflow?.inputs || [
    {
      id: "default-input",
      type: "file",
      title: "Upload Document",
      description: "Upload the file you want to process",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
  ];
  const outputConfig = workflow?.output || {
    type: "csv",
    title: "Output",
    description: "View the final results",
  };

  // #### Render Logic
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Workflow not found</h2>
        <Button onClick={() => router.push("/workflows")}>
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col items-center overflow-y-auto">
      {currentStep !== 3 ? (
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4 gap-2">
              📋 {workflow.title}
            </h1>
            <p className="text-base text-muted-foreground">
              {workflow.description}
            </p>
          </div>

          <ErrorDisplay errorDetails={errorDetails} onReset={resetWorkflow} />

          {!errorDetails && (
            <>
              {currentStep === 1 && (
                <div className="flex flex-col gap-8">
                  {workflowInputs.map((input) => (
                    <FileUploadInput
                      key={input.id}
                      input={input}
                      file={files[input.id]}
                      onFileChange={(file) =>
                        setFiles((prev) => ({ ...prev, [input.id]: file }))
                      }
                      setInput={setInput}
                    />
                  ))}
                  <Button
                    className="w-full mt-6 py-6 text-lg"
                    size="lg"
                    disabled={!areRequiredFilesUploaded()}
                    onClick={onSubmit}
                  >
                    <Play className="h-6 w-6 mr-2" /> Submit and run flow
                  </Button>
                </div>
              )}

              {currentStep === 2 && (
                <ProcessingIndicator
                  reasoning={response?.reasoning}
                  showReasoning={showReasoning}
                  onToggleReasoning={() => setShowReasoning(!showReasoning)}
                />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="mb-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-4 gap-2">
              📋 {workflow.title}
            </h1>
            <p className="text-base text-muted-foreground">
              {workflow.description}
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <OutputDisplay
              response={response}
              outputConfig={outputConfig}
              status={status}
            />
            <div className="flex justify-center">
              <Button size="lg" onClick={resetWorkflow} className="px-8">
                Run Again
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
