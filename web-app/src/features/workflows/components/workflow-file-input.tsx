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
    multiple?: boolean;
  };
  files: (File | WorkflowProjectFile)[] | File | WorkflowProjectFile | null;
  onFileChange: (files: (File | WorkflowProjectFile)[] | File | WorkflowProjectFile | null) => void;
  projectId?: string;
}

/** FileUploadInput: Handles file selection for workflow inputs, supporting both single and multiple file uploads */
function FileUploadInput({
  input,
  files,
  onFileChange,
  projectId,
}: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [showProjectExplorer, setShowProjectExplorer] = useState(false);

  // Convert files to array for uniform processing
  const filesArray = files ? (Array.isArray(files) ? files : [files]) : [];

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

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (!droppedFiles.length) return;

    if (input.multiple) {
      // Check size of each file
      const validFiles = droppedFiles.filter(file => {
        if (input.maxFileSize && file.size > input.maxFileSize) {
          setSizeError(
            `File ${file.name} is too large. Maximum size is ${formatFileSize(
              input.maxFileSize
            )}`
          );
          return false;
        }
        return true;
      });

      if (validFiles.length) {
        setSizeError(null);
        const newFiles = [...filesArray, ...validFiles];
        onFileChange(newFiles);
      }
    } else {
      // Single file mode
      const droppedFile = droppedFiles[0];
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
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (!selectedFiles.length) {
      onFileChange(input.multiple ? [] : null);
      return;
    }

    if (input.multiple) {
      // Check size of each file
      const validFiles = selectedFiles.filter(file => {
        if (input.maxFileSize && file.size > input.maxFileSize) {
          setSizeError(
            `File ${file.name} is too large. Maximum size is ${formatFileSize(
              input.maxFileSize
            )}`
          );
          return false;
        }
        return true;
      });

      if (validFiles.length) {
        setSizeError(null);
        const newFiles = [...filesArray, ...validFiles];
        onFileChange(newFiles);
      }
    } else {
      // Single file mode
      const selectedFile = selectedFiles[0];
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
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    if (input.multiple && Array.isArray(files)) {
      const newFiles = files.filter((_, index) => index !== indexToRemove);
      onFileChange(newFiles.length ? newFiles : null);
    } else {
      onFileChange(null);
    }
    const fileInput = document.getElementById(
      `file-input-${input.id}`
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleProjectFileSelect = async (items: DocumentContent | DocumentContent[]) => {
    const processItem = (item: DocumentContent): WorkflowProjectFile | null => {
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
        return null;
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
          return null;
        }
      }

      // 2. Validate Size
      if (input.maxFileSize && item.size > input.maxFileSize) {
        setSizeError(
          `Selected project file is too large. Maximum size is ${formatFileSize(
            input.maxFileSize
          )}. File size: ${formatFileSize(item.size)}`
        );
        toast.error(sizeError);
        return null;
      }

      // 3. Create ProjectFile Object
      return {
        source: "project",
        name: item.name,
        type: item.mimeType,
        url: item.url,
        size: item.size,
        file_key: item.fileKey,
      };
    };

    const processedFile = processItem(Array.isArray(items) ? items[0] : items);
    if (processedFile) {
      setSizeError(null);
      if (input.multiple) {
        const newFiles = [...filesArray, processedFile];
        onFileChange(newFiles);
      } else {
        onFileChange(processedFile);
      }
      toast.success(`Selected "${processedFile.name}" from project.`);
    }

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
          "border-2 border-dashed border-border rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center relative",
          isDragging
            ? "border-accent bg-accent/10"
            : "hover:border-accent hover:bg-accent/10"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById(`file-input-${input.id}`)?.click()}
      >
        {isHovering && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation();
                openPicker({
                  mode: "files",
                  selectionMode: input.multiple ? "multiple" : "single",
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
                <img src={sharepointLogo} alt="Sharepoint" width={20} height={20} />
              )}
            </Button>
            {projectId && (
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
          </>
        )}

        <input
          type="file"
          id={`file-input-${input.id}`}
          className="hidden"
          multiple={input.multiple}
          accept={Array.isArray(input.acceptedFileTypes) ? input.acceptedFileTypes.join(",") : input.acceptedFileTypes}
          onChange={handleFileSelect}
        />

        <div className="w-full flex flex-col items-center gap-4">
          {isProcessingFiles ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-lg font-medium text-muted-foreground">
                Processing file{input.multiple ? "s" : ""}...
              </p>
            </div>
          ) : (
            <>
              {!files || (!Array.isArray(files) && !files) ? (
                <div className="text-center space-y-4">
                  <div className={cn(
                    "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
                    "bg-muted/30"
                  )}>
                    <FileIcon className={cn("h-8 w-8", "text-muted-foreground")} />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1">
                      Drop your file{input.multiple ? "s" : ""} here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="text-center mb-4">
                    <div className={cn(
                    "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
                    "bg-muted/30"
                  )}>
                    <FileIcon className={cn("h-8 w-8", "text-muted-foreground")} />
                  </div>
                    <p className="text-lg font-medium">
                      Drop your file(s) here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </div>
                  <div className="w-full space-y-2">
                    {(Array.isArray(files) ? files : [files]).map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="text-sm text-primary hover:text-primary/80 flex-shrink-0 hover:cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {input.required && (
        <p
          className={`text-xs mt-2 ${files ? "text-muted-foreground" : "text-red-500"
            }`}
        >
          {files
            ? `✓ Required file${input.multiple ? "s" : ""} ${Array.isArray(files) && files.some(f => "source" in f)
              ? "selected"
              : "uploaded"
            }`
            : "* Required"}
        </p>
      )}

      <Dialog open={showProjectExplorer} onOpenChange={setShowProjectExplorer}>
        <DialogContent className="max-w-[500px] h-auto max-h-[600px] md:max-w-[650px] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select file{input.multiple ? "s" : ""} from project</DialogTitle>
            <DialogDescription>
              Choose {input.multiple ? "files" : "a file"} from the project to use as input for "{input.title}".
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
