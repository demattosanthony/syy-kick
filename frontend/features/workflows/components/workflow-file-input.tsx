import { Button } from "@/components/ui/button";
import useMicrosoftPicker from "@/features/projects/hooks/use-microsoft-picker";
import { SharePointFile } from "@/features/projects/types";
import { cn } from "@/lib/utils";
import { File, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface FileUploadInputProps {
  input: {
    id: string;
    title: string;
    description?: string;
    acceptedFileTypes?: string;
    required?: boolean;
    maxFileSize?: number;
  };
  file: File | null;
  onFileChange: (file: File | null) => void;
}

/** FileUploadInput: Handles file selection for a single workflow input */
function FileUploadInput({
  input,
  file,
  onFileChange,
  setInput,
}: FileUploadInputProps & { setInput: (value: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [sizeError, setSizeError] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const {
    openPicker,
    pickerSelectionsToFiles,
    loading: isMicrosoftPickerLoading,
    isProcessingFiles,
  } = useMicrosoftPicker({
    onFilesSelected: async (files: SharePointFile[]) => {
      const filesToUpload = await pickerSelectionsToFiles(files);
      onFileChange(filesToUpload[0]);
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
      setInput(droppedFile.name);
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
        return;
      }

      setSizeError(null);
      onFileChange(selectedFile);
      setInput(selectedFile.name);
    }
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
          "border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center relative",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted hover:border-primary/50 hover:bg-muted/10"
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
                selectionMode: "single",
                mimeTypes: input.acceptedFileTypes?.split(",") ?? [],
              });
            }}
            disabled={isMicrosoftPickerLoading}
          >
            {isMicrosoftPickerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image
                src={"/logos/sharepoint.svg"}
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
          accept={input.acceptedFileTypes}
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

export default FileUploadInput;
