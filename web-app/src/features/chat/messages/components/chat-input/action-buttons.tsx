import { Button } from "@/components/ui/button";
import { ArrowRight, File, Loader2, Paperclip, Square } from "lucide-react";
import ModelSelector from "../model-selector";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useAtom } from "jotai";
import { uploadsAtom } from "@/atoms/chat";
import { FileUploadMimeType } from "@/types/chat";
import sharepointLogo from "@/assets/logos/sharepoint.svg";
import useMicrosoftPicker, {
  SharePointFile,
} from "@/features/integrations/microsoft/hooks/use-microsoft-picker";
import { SharePointFileBrowser } from "@/features/integrations/microsoft/components/sharepoint-file-browser";
import { validateFile } from "@/hooks/use-file-upload";

interface ActionButtonsProps {
  isGenerating?: boolean;
  input: string;
  stop?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedModel: {
    supportedMimeTypes?: string[];
    maxFileSize?: number;
    maxImageSize?: number;
  };
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFileUploadComplete?: () => void;
}

export function ActionButtons({
  isGenerating,
  input,
  stop,
  onSubmit,
  selectedModel,
  fileInputRef,
  handleFiles,
  onFileUploadComplete,
}: ActionButtonsProps) {
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);

  const [open, setOpen] = useState(false);
  const {
    openPicker,
    pickerSelectionsToFiles,
    loading: isMicrosoftPickerLoading,
    isProcessingFiles,
  } = useMicrosoftPicker({
    onFilesSelected: async (files: SharePointFile[]) => {
      const filesToUpload = await pickerSelectionsToFiles(files);
      const fileUploads = filesToUpload.map((file) => ({
        file: file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith("image/")
          ? "image"
          : ("pdf" as FileUploadMimeType),
      }));
      setUploads([...uploads, ...fileUploads]);
      setOpen(false);
      onFileUploadComplete?.();
    },
  });

  const isAnyLoading =
    isMicrosoftPickerLoading || isProcessingFiles || isDownloadingFile;

  const handleSharePointFileSelect = async (file: any) => {
    if (!file["@microsoft.graph.downloadUrl"]) {
      console.error("No download URL available for this file");
      return;
    }

    setIsDownloadingFile(true);
    try {
      // Download the file directly using the download URL
      const response = await fetch(file["@microsoft.graph.downloadUrl"]);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }

      const blob = await response.blob();
      const contentType =
        response.headers.get("Content-Type") || "application/octet-stream";

      // Create a File object
      const downloadedFile = new window.File([blob], file.name, {
        type: contentType,
      });

      // Validate file using shared logic
      if (
        !validateFile(downloadedFile, selectedModel.supportedMimeTypes || [], {
          maxFileSize: selectedModel.maxFileSize,
          maxImageSize: selectedModel.maxImageSize,
        })
      ) {
        return;
      }

      // Determine file type for uploads
      let fileType: FileUploadMimeType = "pdf";
      if (contentType.startsWith("image/")) {
        fileType = "image";
      }

      // Add to uploads
      const fileUpload = {
        file: downloadedFile,
        preview:
          fileType === "image" ? URL.createObjectURL(downloadedFile) : "",
        type: fileType,
      };

      setUploads([...uploads, fileUpload]);
      onFileUploadComplete?.();
    } catch (error) {
      console.error("Error downloading SharePoint file:", error);
    } finally {
      setIsDownloadingFile(false);
    }
  };

  return (
    <div className="w-full flex justify-between items-center px-1 pb-1">
      <div className="flex items-center gap-1">
        <ModelSelector />
        <SharePointFileBrowser
          onFileSelect={handleSharePointFileSelect}
          isDownloading={isDownloadingFile}
        />
      </div>
      <div className="flex items-center gap-1 h-full">
        {selectedModel.supportedMimeTypes &&
          selectedModel.supportedMimeTypes.length > 0 && (
            <>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    className="h-8 w-8 p-0 rounded-full"
                    variant="ghost"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(true);
                    }}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1">
                  <label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={selectedModel.supportedMimeTypes?.join(",")}
                      multiple
                      onChange={(e) => {
                        e.preventDefault();
                        handleFiles(e);
                        setOpen(false);
                        onFileUploadComplete?.();
                      }}
                    />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-sm cursor-pointer"
                      asChild
                    >
                      <span>
                        <File className="h-4 w-4 text-muted-foreground" />
                        Upload files
                      </span>
                    </Button>
                  </label>
                  <Button
                    variant="ghost"
                    onClick={() => openPicker({ mode: "files" })}
                    className="w-full justify-start gap-2 text-sm cursor-pointer"
                    disabled={isAnyLoading}
                  >
                    {isAnyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <img
                        src={sharepointLogo}
                        alt="Sharepoint"
                        width={16}
                        height={16}
                      />
                    )}
                    Add from SharePoint
                  </Button>
                </PopoverContent>
              </Popover>
            </>
          )}
        <Button
          className="h-8 w-8 rounded-full"
          disabled={!input && !isGenerating}
          variant={!input ? "secondary" : "default"}
          onClick={(e) => {
            e.preventDefault();
            if (isGenerating && stop) stop();
            else onSubmit(e);
          }}
        >
          {isGenerating ? <Square /> : <ArrowRight />}
        </Button>
      </div>
    </div>
  );
}
