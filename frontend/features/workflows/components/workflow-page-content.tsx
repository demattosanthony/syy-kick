"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "ai";
import api from "@/lib/api";
import ErrorDisplay from "./workflow-error-display";
import FileUploadInput from "./workflow-file-input";
import { Workflow } from "../workflows.types";
import { useAtom } from "jotai";
import { initalInputAtom, workflowInputAtom } from "@/atoms/chat";

export type WorkflowAttachment = Attachment & {
  file_key: string;
  inputId: string;
};

export default function WorkflowPageContent({
  workflowId,
  workflow,
}: {
  workflowId: string;
  workflow?: Workflow;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errorDetails, setErrorDetails] = useState<{
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null>(null);
  const hasAutoHiddenReasoning = useRef(false);
  const [, setWorkflowInput] = useAtom(workflowInputAtom);
  const [, setInitalInput] = useAtom(initalInputAtom);

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
    setErrorDetails(null);
    hasAutoHiddenReasoning.current = false;
    if (errorDetails) window.location.reload();
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
      const attachments: WorkflowAttachment[] = [];
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
          inputId,
        });
      }
      const fileNames = Object.values(files)
        .filter(Boolean)
        .map((file) => file?.name)
        .join(", ");

      setWorkflowInput({
        attachments,
        input: "",
      });
      setInitalInput(`Process the following files: ${fileNames}.`);

      const thread = await api.threads.createThread();
      router.push(
        `/threads/${thread.id}?isNew=true&isWorkflow=true&workflowId=${workflowId}`
      );
    } catch (err) {
      console.error("Submission error:", err);
      setErrorDetails({
        type: "general",
        message: "An unexpected error occurred. Please try again.",
      });
    }
  };

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
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-secondary/10">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="mb-6 text-center">
          <div className="inline-block p-3 mb-6 rounded-full bg-primary/10">
            <span className="text-4xl">📋</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{workflow.title}</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {workflow.description}
          </p>
        </div>

        <ErrorDisplay errorDetails={errorDetails} onReset={resetWorkflow} />

        {!errorDetails && (
          <div className="rounded-xl p-8">
            <div className="flex flex-col gap-8">
              {workflowInputs.map((input) => (
                <FileUploadInput
                  key={input.id}
                  input={{
                    ...input,
                    maxFileSize: 32 * 1024 * 1024 /* 32 MB */,
                  }}
                  file={files[input.id]}
                  onFileChange={(file) =>
                    setFiles((prev) => ({ ...prev, [input.id]: file }))
                  }
                  setInput={() => {}}
                />
              ))}
              <Button
                className="w-full mt-6 py-7 text-lg font-medium transition-all hover:scale-[1.02]"
                size="lg"
                disabled={!areRequiredFilesUploaded()}
                onClick={onSubmit}
              >
                <Play className="h-6 w-6 mr-3" />
                {areRequiredFilesUploaded()
                  ? "Submit and run"
                  : "Upload required files to continue"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
