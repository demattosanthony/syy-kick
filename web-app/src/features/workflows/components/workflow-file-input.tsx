import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import sharepointLogo from "@/assets/logos/sharepoint.svg";
import useMicrosoftPicker from "@/features/integrations/microsoft/hooks/use-microsoft-picker";
import { SharePointFile } from "@/features/integrations/microsoft/hooks/use-microsoft-picker";

interface FileUploadInputProps {
  input: {
    id: string;
    title: string;
    description?: string;
    acceptedFileTypes?: string | string[];
    required?: boolean;
    maxFileSize?: number;
  };
  files: File[];
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
}

/** FileUploadInput: Handles file selection for workflow inputs */
function FileUploadInput({ input, files, multiple = false, onFilesChange }: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const {
    openPicker,
    pickerSelectionsToFiles,
    loading: isMicrosoftPickerLoading,
    isProcessingFiles,
  } = useMicrosoftPicker({
    onFilesSelected: async (sharePointFiles: SharePointFile[]) => {
      const filesToUpload = await pickerSelectionsToFiles(sharePointFiles);
      if (filesToUpload.length > 0) {
        // Check size for each file
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        for (const file of filesToUpload) {
          if (input.maxFileSize && file.size > input.maxFileSize) {
            invalidFiles.push(file.name);
          } else {
            validFiles.push(file);
          }
        }

        if (invalidFiles.length > 0) {
          setSizeError(
            `Files too large: ${invalidFiles.join(", ")}. Maximum size is ${formatFileSize(
              input.maxFileSize!
            )}`
          );
        } else {
          setSizeError(null);
        }

        if (multiple) {
          // Add to existing files
          onFilesChange([...files, ...validFiles]);
        } else {
          // Replace with first file only
          onFilesChange(validFiles.slice(0, 1));
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

    if (droppedFiles.length > 0) {
      // Check file size for each file
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      for (const file of droppedFiles) {
        if (input.maxFileSize && file.size > input.maxFileSize) {
          invalidFiles.push(file.name);
        } else {
          validFiles.push(file);
        }
      }

      if (invalidFiles.length > 0) {
        setSizeError(
          `Files too large: ${invalidFiles.join(", ")}. Maximum size is ${formatFileSize(
            input.maxFileSize!
          )}`
        );
      } else {
        setSizeError(null);
      }

      if (multiple) {
        // Add to existing files
        onFilesChange([...files, ...validFiles]);
      } else {
        // Replace with first file only
        onFilesChange(validFiles.slice(0, 1));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length > 0) {
      // Check file size for each file
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      for (const file of selectedFiles) {
        if (input.maxFileSize && file.size > input.maxFileSize) {
          invalidFiles.push(file.name);
        } else {
          validFiles.push(file);
        }
      }

      if (invalidFiles.length > 0) {
        setSizeError(
          `Files too large: ${invalidFiles.join(", ")}. Maximum size is ${formatFileSize(
            input.maxFileSize!
          )}`
        );
      } else {
        setSizeError(null);
      }

      if (multiple) {
        // Add to existing files
        onFilesChange([...files, ...validFiles]);
      } else {
        // Replace with first file only
        onFilesChange(validFiles.slice(0, 1));
      }
    } else {
      // Handle case where user cancels file selection
      if (!multiple) {
        onFilesChange([]);
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const removeAllFiles = () => {
    onFilesChange([]);
    const fileInput = document.getElementById(
      `file-input-${input.id}`
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
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

  const hasFiles = files.length > 0;
  const displayFile = files[0]; // For single file display

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
        onClick={() =>
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
                selectionMode: multiple ? "multiple" : "single",
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

        <input
          type="file"
          id={`file-input-${input.id}`}
          className="hidden"
          multiple={multiple}
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
                Processing files...
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "w-16 h-16 mx-auto rounded-full flex items-center justify-center",
                  hasFiles ? "bg-primary/10" : "bg-muted/30"
                )}
              >
                <FileIcon
                  className={cn(
                    "h-8 w-8",
                    hasFiles ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <div>
                {hasFiles ? (
                  <div className="space-y-2">
                    {multiple ? (
                      <>
                        <p className="text-lg font-medium mb-1">
                          {files.length} file{files.length > 1 ? 's' : ''} selected
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                              <span className="truncate flex-1">{file.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                className="ml-2 text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAllFiles();
                          }}
                          className="mt-2 text-sm text-primary hover:text-primary/80 font-medium"
                        >
                          Remove all files
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-medium mb-1">
                          {displayFile.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {`${(displayFile.size / (1024 * 1024)).toFixed(2)} MB · ${
                            displayFile.type.includes("pdf")
                              ? "PDF"
                              : displayFile.type && displayFile.type.includes("/")
                              ? displayFile.type.split("/")[1].toUpperCase()
                              : "FILE"
                          }`}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAllFiles();
                          }}
                          className="mt-3 text-sm text-primary hover:text-primary/80 font-medium flex items-center justify-center mx-auto"
                        >
                          <span className="mr-1">×</span> Remove file
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-1">
                      {multiple ? "Drop your files here" : "Drop your file here"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {multiple ? "or click to browse multiple files" : "or click to browse"}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {sizeError && <p className="text-xs mt-2 text-red-500">{sizeError}</p>}

      {input.maxFileSize && !sizeError && (
        <p className="text-xs mt-2 text-muted-foreground">
          Max size per file: {formatFileSize(input.maxFileSize)}
        </p>
      )}
    </div>
  );
}

export default FileUploadInput;
