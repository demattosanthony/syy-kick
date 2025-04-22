"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "ai";
import api from "@/lib/api";
import ErrorDisplay from "./workflow-error-display";
import FileUploadInput, { ProjectFile } from "./workflow-file-input";
import { Workflow } from "../workflows.types";
import { useAtom } from "jotai";
import { initalInputAtom, workflowInputAtom } from "@/atoms/chat";
import { ThreadsList } from "@/features/chat/threads/components";

export type WorkflowAttachment = Attachment & {
  file_key: string;
  inputId: string;
};

export default function WorkflowPageContent({
  workflowId,
  projectId,
  workflow,
}: {
  workflowId: string;
  projectId?: string;
  workflow?: Workflow;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, File | ProjectFile | null>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const initialFiles: Record<string, File | ProjectFile | null> = {};
      workflow.inputs.forEach((input) => (initialFiles[input.id] = null));
      setFiles(initialFiles);
    }
  }, [workflow]);

  // Reset workflow state and reload page
  const resetWorkflow = () => {
    if (workflow?.inputs) {
      const resetFiles: Record<string, File | ProjectFile | null> = {};
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

    setIsSubmitting(true);
    try {
      const attachments: WorkflowAttachment[] = [];
      for (const inputId in files) {
        const fileOrProjectFile = files[inputId];
        if (!fileOrProjectFile) continue;

        // Check if it's a ProjectFile or a regular File
        if (
          "source" in fileOrProjectFile &&
          fileOrProjectFile.source === "project"
        ) {
          // It's a ProjectFile, use its existing details
          attachments.push({
            name: fileOrProjectFile.name,
            contentType: fileOrProjectFile.type, // Use 'type' from ProjectFile
            url: fileOrProjectFile.url, // Use existing URL
            file_key: fileOrProjectFile.file_key, // Use existing file_key
            inputId,
          });
        } else {
          // It's a regular File, proceed with upload
          const file = fileOrProjectFile as File; // Type assertion
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
      }
      const fileNames = Object.values(files)
        .filter(Boolean)
        .map((file) => file?.name) // Works for both File and ProjectFile
        .join(", ");

      setWorkflowInput({
        attachments,
        input: "",
      });
      setInitalInput(`Process the following files: ${fileNames}.`);

      const thread = await api.threads.createThread({
        workflowId,
      });
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

    setIsSubmitting(false);
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

  if (workflow === null) {
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
    <div className="max-w-2xl mx-auto flex flex-col items-center w-full">
      <div className="mb-6 text-center">
        <div className="inline-block p-3 mb-6 rounded-full bg-primary/10">
          <span className="text-4xl">📋</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">{workflow?.title}</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          {workflow?.description}
        </p>
      </div>

      <ErrorDisplay errorDetails={errorDetails} onReset={resetWorkflow} />

      {!errorDetails && (
        <div className="rounded-xl p-8 w-full">
          <div className="flex flex-col gap-8">
            {workflowInputs.map((input) => (
              <FileUploadInput
                key={input.id}
                input={{
                  ...input,
                  maxFileSize: 50 * 1024 * 1024 /* 50 MB */,
                }}
                file={files[input.id]}
                onFileChange={(file) =>
                  setFiles((prev) => ({ ...prev, [input.id]: file }))
                }
                projectId={projectId}
              />
            ))}
            <Button
              className="w-full mt-6 py-7 text-lg font-medium transition-all hover:scale-[1.02]"
              size="lg"
              disabled={!areRequiredFilesUploaded()}
              onClick={onSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader className="animate-spin h-6 w-6 mr-3" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-6 w-6 mr-3" />
                  {areRequiredFilesUploaded()
                    ? "Submit and run"
                    : "Upload required files to continue"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* History section */}
      <div className="mt-12 w-full max-w-xl">
        <h2 className="text-2xl font-bold mb-6">History</h2>
        <div className="">
          <ThreadsList workflowId={workflowId} showLatestMessage={false} />
        </div>
      </div>
    </div>
  );
}
