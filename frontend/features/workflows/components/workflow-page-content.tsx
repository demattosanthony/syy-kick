"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflowQuery } from "../api";
import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Attachment } from "ai";
import api from "@/lib/api";
import { extractSpecialContent } from "@/lib/artifact-utils";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "@/features/chat/messages/components";
import { CsvViewer } from "@/features/chat/messages/components/viewers/artifact-viewer";
import { useCsvActions } from "@/hooks/use-csv-actions";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

function StepHeader({
  number,
  title,
  description,
  isActive,
  isLoading,
}: {
  number: number;
  title: string;
  description?: string;
  isActive?: boolean;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full font-medium",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : number}
      </div>
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export default function WorkflowPageContent({
  workflowId,
}: {
  workflowId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const hasAutoHiddenReasoning = useRef(false);

  const { downloadCsv, previewCsv } = useCsvActions();

  const { data: workflow, isLoading } = useWorkflowQuery(workflowId);
  const { handleSubmit, messages, setInput, status, setMessages, error } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_API_URL}/workflows/${workflowId}/run`,
      credentials: "include",
      experimental_prepareRequestBody({ messages, id }) {
        return { message: messages[messages.length - 1], id };
      },
    });

  const isProcessing = status === "submitted" || messages.length > 0;
  const response = messages[1];

  const resetWorkflow = () => {
    setFile(null);
    setInput("");
    hasAutoHiddenReasoning.current = false;
    setShowReasoning(true);
    setMessages([]);
  };

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
    setFile(droppedFile);
    setInput(droppedFile.name);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setInput(e.target.files[0].name);
    }
  };

  async function onSubmit() {
    if (!file) return;

    const { url, file_metadata, viewUrl } = await api.uploads.getPresignedUrl(
      file.name,
      file.type,
      file.size,
      `uploads/${Date.now()}-${file.name}`
    );

    await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    const attachment: ExtendedAttachment = {
      name: file.name,
      contentType: file.type,
      url: viewUrl,
      file_key: file_metadata.file_key,
    };

    handleSubmit({ preventDefault: () => {} } as React.FormEvent, {
      experimental_attachments: [attachment],
    });
  }

  // Update getCurrentStep to auto-hide reasoning when moving to step 3
  const getCurrentStep = () => {
    if (!file) return 1;
    if (isProcessing && (!response?.content || response?.content === "")) {
      return 2;
    }
    if (response) {
      // Auto-hide reasoning only when initially moving to step 3
      // Use a ref or state to track if we've already done this
      if (showReasoning && !hasAutoHiddenReasoning.current) {
        setShowReasoning(false);
        hasAutoHiddenReasoning.current = true;
      }
      return 3;
    }
    return 1;
  };

  const currentStep = getCurrentStep();

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
      <div className="container mx-auto px-4 py-12 max-w-4xl ">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">{workflow.title}</h1>
          <p className="text-lg text-muted-foreground">
            {workflow.description}
          </p>
        </div>

        {/* Display error message if there's an error */}
        {error && (
          <div className="mb-8 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
            <h3 className="font-medium mb-1">Error</h3>
            <p>
              {error.message ||
                "An error occurred while running the workflow. Please try again."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-8">
          {/* Step 1: Upload RFP document */}
          <div>
            <StepHeader
              number={1}
              title="Upload RFP document"
              description="Upload the document you want to analyze"
              isActive={currentStep === 1}
            />

            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-12 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-primary/50 hover:bg-muted/10",
                !isProcessing ? "block" : "hidden"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                type="file"
                id="file-input"
                className="hidden"
                accept="application/pdf"
                onChange={handleFileSelect}
              />
              <div className="text-center space-y-6">
                <div
                  className={cn(
                    "w-20 h-20 mx-auto rounded-full flex items-center justify-center",
                    file ? "bg-primary/10" : "bg-muted/30"
                  )}
                >
                  <File
                    className={cn(
                      "h-10 w-10",
                      file ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <p className="text-xl font-medium mb-2">
                    {file ? file.name : "Drop your file here"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · PDF${
                          file.type.includes("pdf") ? "" : " (recommended)"
                        }`
                      : "or click to browse"}
                  </p>
                  {file && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setInput("");
                      }}
                      className="mt-4 text-sm text-primary hover:text-primary/80 font-medium flex items-center justify-center mx-auto"
                    >
                      <span className="mr-1">×</span> Remove file
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!isProcessing && (
              <Button
                className="w-full mt-6 py-6 text-lg"
                size="lg"
                disabled={!file}
                onClick={onSubmit}
              >
                {file ? "Run Workflow" : "Select a file to continue"}
              </Button>
            )}
          </div>

          {/* Step 2: Reasoning */}
          <div>
            <div className="flex justify-between items-center">
              <StepHeader
                number={2}
                title="Reasoning"
                description="View the analysis process"
                isActive={currentStep === 2}
                isLoading={currentStep === 2}
              />
              {response?.reasoning && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-1"
                >
                  {showReasoning ? (
                    <>
                      Hide <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Show <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {response?.reasoning && showReasoning ? (
              <div className="bg-muted/30 p-4 rounded-lg max-h-[400px] overflow-y-auto">
                <MarkdownViewer content={response.reasoning || ""} />
              </div>
            ) : null}
          </div>

          {/* Step 3: Output */}
          <div>
            <StepHeader
              number={3}
              title="Output"
              description="View the final results"
              isActive={currentStep === 3}
            />

            {response && response?.content && (
              <div className="bg-card rounded-xl p-6 shadow-lg border">
                {typeof response?.content === "string" &&
                  (() => {
                    const { artifact } = extractSpecialContent(
                      response?.content
                    );
                    if (!artifact?.content) return null;

                    return (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium">Results</h3>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const csvContent = artifact.content;
                                downloadCsv(csvContent);
                              }}
                            >
                              Download CSV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const csvContent = artifact.content;
                                previewCsv(csvContent, "CSV Results");
                              }}
                            >
                              View Full Screen
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded">
                          <div className="min-w-max">
                            <CsvViewer content={artifact.content} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Add Run Again button outside the CSV card and only when streaming is complete */}
            {response && response?.content && status !== "submitted" && (
              <div className="mt-8 flex justify-center">
                <Button size="lg" onClick={resetWorkflow} className="px-8">
                  Reset
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
