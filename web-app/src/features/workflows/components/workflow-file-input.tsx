import { Button } from "@/components/ui/button";
import useMicrosoftPicker from "@/features/projects/hooks/use-microsoft-picker";
import { SharePointFile } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import { FileIcon, Loader2, Folder } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectFileExplorer } from "@/features/projects/components";
import { DocumentContent } from "@/types/project";
import { toast } from "sonner";
import { WorkflowProjectFile } from "../workflows.types";
import sharepointLogo from "@/assets/logos/sharepoint.svg";

interface FileUploadInputProps {
  input: {
    id: string;
    title: string;
    description?: string;
    acceptedFileTypes?: string | string[];
    required?: boolean;
    maxFileSize?: number;
  };
  file: File | WorkflowProjectFile | null;
  onFileChange: (file: File | WorkflowProjectFile | null) => void;
  projectId?: string;
}

/** FileUploadInput: Handles file selection for a single workflow input */
function FileUploadInput({
  input,
  file,
  onFileChange,
  projectId,
}: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showProjectExplorer, setShowProjectExplorer] = useState(false);

  const {
    openPicker,
    pickerSelectionsToFiles,
    loading: isMicrosoftPickerLoading,
    isProcessingFiles,
  } = useMicrosoftPicker({
    onFilesSelected: async (files: SharePointFile[]) => {
      const filesToUpload = await pickerSelectionsToFiles(files);
      if (filesToUpload.length > 0) {
        // Check size before setting
        const selectedFile = filesToUpload[0];
        if (input.maxFileSize && selectedFile.size > input.maxFileSize) {
          setSizeError(
            `File is too large. Maximum size is ${formatFileSize(
              input.maxFileSize
            )}`
          );
          onFileChange(null); // Clear any previous selection
        } else {
          setSizeError(null);
          onFileChange(selectedFile);
        }
      }
    },
  });

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
      // Check file size if maxFileSize is specified
      if (input.maxFileSize && droppedFile.size > input.maxFileSize) {
        setSizeError(
          `File is too large. Maximum size is ${formatFileSize(
            input.maxFileSize
          )}`
        );
        return;
      }

      setSizeError(null);
      onFileChange(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    if (selectedFile) {
      // Check file size if maxFileSize is specified
      if (input.maxFileSize && selectedFile.size > input.maxFileSize) {
        setSizeError(
          `File is too large. Maximum size is ${formatFileSize(
            input.maxFileSize
          )}`
        );

        onFileChange(null);
        return;
      }

      setSizeError(null);
      onFileChange(selectedFile);
    } else {
      // Handle case where user cancels file selection
      onFileChange(null);
    }
  };

  const handleProjectFileSelect = async (item: DocumentContent) => {
    // Check if item is a file and has all required information
    if (
      item.type !== "file" ||
      !projectId ||
      !item.fileKey ||
      !item.size ||
      !item.url ||
      !item.mimeType
    ) {
      toast.error(
        `Selected item is missing required information (key, size, url, or mimeType). Cannot use this file.`
      );
      console.error("Missing required info in DocumentContent:", item);
      return;
    }

    // 1. Check Mime Type
    if (input.acceptedFileTypes) {
      const acceptedFileTypes = Array.isArray(input.acceptedFileTypes)
        ? input.acceptedFileTypes
        : input.acceptedFileTypes
        ? [input.acceptedFileTypes]
        : [];

      if (!acceptedFileTypes.some((type) => type.trim() === item.mimeType)) {
        toast.error(
          `File type (${item.mimeType}) is not accepted for this input.`
        );
        return;
      }
    }

    // 2. Validate Size (using item.size)
    if (input.maxFileSize && item.size > input.maxFileSize) {
      setSizeError(
        `Selected project file is too large. Maximum size is ${formatFileSize(
          input.maxFileSize
        )}. File size: ${formatFileSize(item.size)}`
      );
      toast.error(sizeError);
      setShowProjectExplorer(false); // Close dialog even on error
      onFileChange(null); // Ensure state is cleared
      return;
    }

    // 3. Create ProjectFile Object - No download needed
    const projectFile: WorkflowProjectFile = {
      source: "project",
      name: item.name,
      type: item.mimeType,
      url: item.url, // Use the existing URL
      size: item.size,
      file_key: item.fileKey, // Use the existing file_key
    };

    // 4. Update State and Close
    setSizeError(null);
    onFileChange(projectFile); // Pass the ProjectFile object
    toast.success(`Selected "${item.name}" from project.`);
    setShowProjectExplorer(false);
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-2">{input.title}</h3>
      <div
        className={cn(
          "border-2 border-dashed border-border rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center relative", // Use border-border for adaptive base color (greyer in dark mode)
          isDragging
            ? "border-accent bg-accent/10" // Dragging state uses accent border
            : "hover:border-accent hover:bg-accent/10" // Hover state also uses accent border and subtle background
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() =>
          // Don't open file dialog if a project file is selected
          !(file && "source" in file && file.source === "project") &&
          document.getElementById(`file-input-${input.id}`)?.click()
        }
      >
        {isHovering && (
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2"
            onClick={(e) => {
              e.stopPropagation();
              openPicker({
                mode: "files",
                selectionMode: "single",
                mimeTypes: Array.isArray(input.acceptedFileTypes)
                  ? input.acceptedFileTypes
                  : input.acceptedFileTypes
                  ? [input.acceptedFileTypes]
                  : [],
              });
            }}
            disabled={isMicrosoftPickerLoading}
          >
            {isMicrosoftPickerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <img
                src={sharepointLogo}
                alt="Sharepoint"
                width={20}
                height={20}
              />
            )}
          </Button>
        )}
        {isHovering && projectId && (
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-14"
            onClick={(e) => {
              e.stopPropagation();
              setShowProjectExplorer(true);
            }}
            title="Select file from project"
          >
            <Folder className="h-4 w-4" />
          </Button>
        )}
        <input
          type="file"
          id={`file-input-${input.id}`}
          className="hidden"
          accept={
            Array.isArray(input.acceptedFileTypes)
              ? input.acceptedFileTypes.join(",")
              : input.acceptedFileTypes
          }
          onChange={handleFileSelect}
        />
        <div className="text-center space-y-4">
          {isProcessingFiles ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-lg font-medium text-muted-foreground">
                Processing file...
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
                  file ? "bg-primary/10" : "bg-muted/30"
                )}
              >
                <FileIcon
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
                          : file.type && file.type.includes("/")
                          ? file.type.split("/")[1].toUpperCase()
                          : "FILE"
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
            </>
          )}
        </div>
      </div>

      {sizeError && <p className="text-xs mt-2 text-red-500">{sizeError}</p>}

      {input.maxFileSize && !sizeError && (
        <p className="text-xs mt-2 text-muted-foreground">
          Max size: {formatFileSize(input.maxFileSize)}
        </p>
      )}

      <Dialog open={showProjectExplorer} onOpenChange={setShowProjectExplorer}>
        <DialogContent className="max-w-[500px] h-auto max-h-[600px] md:max-w-[650px] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select file from project</DialogTitle>
            <DialogDescription>
              Choose a file from the project to use as input for "{input.title}
              ".
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-[500px]">
            <ScrollArea className="h-full w-full">
              <ProjectFileExplorer
                projectId={projectId}
                contentSource="project"
                variant="compact"
                onFileSelect={handleProjectFileSelect}
              />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FileUploadInput;
