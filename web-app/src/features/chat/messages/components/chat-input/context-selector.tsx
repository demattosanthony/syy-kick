import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useState } from "react";
import {
  SharePointFileBrowser,
  SharePointItem,
} from "@/features/integrations/microsoft/components/sharepoint-file-browser";
import { validateFile } from "@/lib/utils/file-validation";
import { useFileUpload } from "@/hooks/use-file-upload";

interface ContextSelectorProps {
  showContextSelector: boolean;
  selectedModel: {
    supportedMimeTypes?: string[];
    maxFileSize?: number;
    maxImageSize?: number;
  };
}

export function ContextSelector({
  showContextSelector,
  selectedModel,
}: ContextSelectorProps) {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);

  const { processFileUpload } = useFileUpload(
    selectedModel.supportedMimeTypes || []
  );

  const handleSharePointFileSelect = async (file: SharePointItem) => {
    if (!file["@microsoft.graph.downloadUrl"]) {
      toast.error("No download URL available for this file.");
      setShowFileExplorer(false);
      return;
    }

    setIsDownloadingFile(true);
    try {
      const response = await fetch(file["@microsoft.graph.downloadUrl"]);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const contentType =
        response.headers.get("Content-Type") || "application/octet-stream";

      const downloadedFile = new window.File([blob], file.name, {
        type: contentType,
      });

      if (
        !validateFile(downloadedFile, selectedModel.supportedMimeTypes || [], {
          maxFileSize: selectedModel.maxFileSize,
          maxImageSize: selectedModel.maxImageSize,
        })
      ) {
        setIsDownloadingFile(false);
        return;
      }

      await processFileUpload(downloadedFile);

      setShowFileExplorer(false);
    } catch (error) {
      console.error("Error processing SharePoint file:", error);
      toast.error("Failed to add SharePoint file. Please try again.");
    } finally {
      setIsDownloadingFile(false);
    }
  };

  if (!showContextSelector) return null;

  return (
    <div className="flex items-center w-full h-auto flex-wrap gap-2">
      <Popover open={showFileExplorer} onOpenChange={setShowFileExplorer}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="text-xs px-2 font-normal  hover:bg-transparent hover:text-accent-foreground h-6 border-none "
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowFileExplorer(true);
            }}
          >
            + Add context
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[325px] p-0 border-none">
          <SharePointFileBrowser
            displayMode="inline"
            onFileSelect={handleSharePointFileSelect}
            isDownloading={isDownloadingFile}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
