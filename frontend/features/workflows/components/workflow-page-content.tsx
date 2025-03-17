"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, File, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflowQuery } from "../api";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Attachment } from "ai";
import api from "@/lib/api";
import { extractSpecialContent } from "@/lib/artifact-utils";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "@/features/chat/messages/components";
import { CsvViewer } from "@/features/chat/messages/components/viewers/artifact-viewer";
import { useCsvActions } from "@/hooks/use-csv-actions";
import { Loader } from "@/components/ui/loader";

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
        {isLoading ? <Loader className="h-4 w-4" variant="circular" /> : number}
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
  // Replace single file state with a map of input IDs to files
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [isDragging, setIsDragging] = useState<Record<string, boolean>>({});
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

  // Initialize files and dragging state when workflow data loads
  useEffect(() => {
    if (workflow?.inputs) {
      const initialFiles: Record<string, File | null> = {};
      const initialDragging: Record<string, boolean> = {};

      workflow.inputs.forEach((input) => {
        initialFiles[input.id] = null;
        initialDragging[input.id] = false;
      });

      setFiles(initialFiles);
      setIsDragging(initialDragging);
    }
  }, [workflow]);

  const resetWorkflow = () => {
    // Reset all files
    if (workflow?.inputs) {
      const resetFiles: Record<string, File | null> = {};
      workflow.inputs.forEach((input) => {
        resetFiles[input.id] = null;
      });
      setFiles(resetFiles);
    }
    setInput("");
    hasAutoHiddenReasoning.current = false;
    setShowReasoning(true);
    setMessages([]);
  };

  const handleDragOver = (inputId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [inputId]: true }));
  };

  const handleDragLeave = (inputId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [inputId]: false }));
  };

  const handleDrop = (inputId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging((prev) => ({ ...prev, [inputId]: false }));
    const droppedFile = e.dataTransfer.files[0];
    setFiles((prev) => ({ ...prev, [inputId]: droppedFile }));
  };

  const handleFileSelect =
    (inputId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        setFiles((prev) => ({
          ...prev,
          [inputId]: e.target.files?.[0] || null,
        }));
        setInput(e.target.files[0].name);
      }
    };

  const areRequiredFilesUploaded = () => {
    if (!workflow?.inputs) return false;

    return workflow.inputs
      .filter((input) => input.required)
      .every((input) => files[input.id]);
  };

  async function onSubmit() {
    if (!areRequiredFilesUploaded()) return;

    // Create an array to store all attachments
    const attachments: ExtendedAttachment[] = [];

    // Process each file
    for (const inputId in files) {
      const file = files[inputId];
      if (!file) continue;

      const { url, file_metadata, viewUrl } = await api.uploads.getPresignedUrl(
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

    // Set input to a description of the files
    const fileNames = Object.values(files)
      .filter(Boolean)
      .map((file) => file?.name)
      .join(", ");
    setInput(fileNames);

    handleSubmit({ preventDefault: () => {} } as React.FormEvent, {
      experimental_attachments: attachments,
    });
  }

  // Update getCurrentStep to auto-hide reasoning when moving to step 3
  const getCurrentStep = () => {
    if (!areRequiredFilesUploaded()) return 1;
    if (isProcessing && (!response?.content || response?.content === "")) {
      return 2;
    }
    if (response) {
      // Auto-hide reasoning only when initially moving to step 3
      if (showReasoning && !hasAutoHiddenReasoning.current) {
        setShowReasoning(false);
        hasAutoHiddenReasoning.current = true;
      }
      return 3;
    }
    return 1;
  };

  const currentStep = getCurrentStep();
  console.log("Current step:", currentStep);

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

  // Default to a single file input if no inputs are defined
  const workflowInputs = workflow.inputs || [
    {
      id: "default-input",
      type: "file",
      title: "Upload Document",
      description: "Upload the file you want to process",
      acceptedFileTypes: "application/pdf",
      required: true,
    },
  ];

  // Get output configuration
  const outputConfig = workflow.output || {
    type: "csv",
    title: "Output",
    description: "View the final results",
  };
  return (
    <div className="h-screen w-full flex flex-col items-center overflow-y-auto">
      <div className="container mx-auto px-4 py-16 max-w-3xl ">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 gap-2">
            📋&nbsp;{workflow.title}
          </h1>
          <p className="text-base text-muted-foreground">
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
          {/* Step 1: Upload documents - now supports multiple inputs */}
          <div>
            {workflowInputs.map((input, index) => (
              <div key={input.id} className="mb-6">
                <h3 className="text-lg font-bold mb-2">{input.title}</h3>
                {/* {input.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {input.description}
                  </p>
                )} */}

                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center",
                    isDragging[input.id]
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50 hover:bg-muted/10",
                    !isProcessing ? "block" : "hidden"
                  )}
                  onDragOver={handleDragOver(input.id)}
                  onDragLeave={handleDragLeave(input.id)}
                  onDrop={handleDrop(input.id)}
                  onClick={() =>
                    document.getElementById(`file-input-${input.id}`)?.click()
                  }
                >
                  <input
                    type="file"
                    id={`file-input-${input.id}`}
                    className="hidden"
                    accept={input.acceptedFileTypes}
                    onChange={handleFileSelect(input.id)}
                  />
                  <div className="text-center space-y-4">
                    <div
                      className={cn(
                        "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
                        files[input.id] ? "bg-primary/10" : "bg-muted/30"
                      )}
                    >
                      <File
                        className={cn(
                          "h-8 w-8",
                          files[input.id]
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div>
                      <p className="text-lg font-medium mb-1">
                        {files[input.id]
                          ? files[input.id]?.name
                          : "Drop your file here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {files[input.id]
                          ? `${(files[input.id]!.size / (1024 * 1024)).toFixed(
                              2
                            )} MB · ${
                              files[input.id]!.type.includes("pdf")
                                ? "PDF"
                                : files[input.id]!.type.split(
                                    "/"
                                  )[1].toUpperCase()
                            }`
                          : "or click to browse"}
                      </p>
                      {files[input.id] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles((prev) => ({ ...prev, [input.id]: null }));
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
                      files[input.id] ? "text-muted-foreground" : "text-red-500"
                    }`}
                  >
                    {files[input.id]
                      ? "✓ Required file uploaded"
                      : "* Required"}
                  </p>
                )}
              </div>
            ))}

            {!isProcessing && (
              <Button
                className="w-full mt-6 py-6 text-lg"
                size="lg"
                disabled={!areRequiredFilesUploaded()}
                onClick={onSubmit}
              >
                <Play className="h-6 w-6" />
                {"Submit and run flow"}
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

                    // Render based on output type
                    if (
                      outputConfig.type === "csv" ||
                      outputConfig.type === "table"
                    ) {
                      return (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium">
                              {outputConfig.title || "Results"}
                            </h3>
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
                                  previewCsv(
                                    csvContent,
                                    outputConfig.title || "CSV Results"
                                  );
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
                    } else {
                      // Default rendering for other output types
                      return (
                        <div className="space-y-4">
                          <h3 className="font-medium">
                            {outputConfig.title || "Results"}
                          </h3>
                          <div className="prose prose-sm max-w-none">
                            <MarkdownViewer content={artifact.content} />
                          </div>
                        </div>
                      );
                    }
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
