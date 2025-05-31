import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { DocumentContent } from "@/types/project";
import { useAtom } from "jotai";
import { selectedProjectDocsAtom } from "@/atoms/chat";
import { toast } from "sonner";
import { useState } from "react";
import {
  SharePointFileBrowser,
  SharePointItem,
} from "@/features/integrations/microsoft/components/sharepoint-file-browser";
import { validateFile } from "@/lib/utils/file-validation";
import { FileUploadMimeType } from "@/types/chat";
import { uploadsAtom } from "@/atoms/chat";

interface ContextSelectorProps {
  showContextSelector: boolean;
  projectId?: string;
  selectedModel: {
    supportedMimeTypes?: string[];
    maxFileSize?: number;
    maxImageSize?: number;
  };
}

export function ContextSelector({
  showContextSelector,
  projectId,
  selectedModel,
}: ContextSelectorProps) {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [selectedProjectDocs, setSelectedProjectDocs] = useAtom(
    selectedProjectDocsAtom
  );
  const [, setUploads] = useAtom(uploadsAtom);
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);

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

      let fileType: FileUploadMimeType = "other";
      if (contentType.startsWith("image/")) {
        fileType = "image";
      } else if (contentType === "application/pdf") {
        fileType = "pdf";
      }

      const fileUpload = {
        file: downloadedFile,
        preview:
          fileType === "image" ? URL.createObjectURL(downloadedFile) : "",
        type: fileType,
        name: downloadedFile.name,
        path: file.webUrl || file.id,
      };

      const newDoc: DocumentContent = {
        id: file.id || file.webUrl || Date.now().toString(),
        name: downloadedFile.name,
        path: file.webUrl || file.id,
        type: "file",
        mimeType: contentType,
        size: downloadedFile.size,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSelectedProjectDocs((prev) =>
        prev.find((doc) => doc.path === newDoc.path) ? prev : [...prev, newDoc]
      );

      toast.success(`Added ${downloadedFile.name} to context.`);
      setShowFileExplorer(false);
    } catch (error) {
      console.error("Error processing SharePoint file for context:", error);
      toast.error(
        "Failed to add SharePoint file to context. Please try again."
      );
    } finally {
      setIsDownloadingFile(false);
    }
  };

  if (!showContextSelector) return null;

  return (
    <div className="flex items-center w-full h-auto flex-wrap gap-2">
      <Button
        variant="ghost"
        className="text-xs px-2 font-normal  hover:bg-transparent hover:text-accent-foreground h-6 "
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowFileExplorer(true);
        }}
      >
        + Add context
      </Button>

      <Dialog open={showFileExplorer} onOpenChange={setShowFileExplorer}>
        <DialogContent className="max-w-[500px] h-auto max-h-[700px] md:max-w-[650px] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select files for context from SharePoint</DialogTitle>
            <DialogDescription>
              Choose files from SharePoint to add as context.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[400px] overflow-y-auto">
            <SharePointFileBrowser
              displayMode="inline"
              onFileSelect={handleSharePointFileSelect}
              isDownloading={isDownloadingFile}
            />
          </div>
        </DialogContent>
      </Dialog>

      {selectedProjectDocs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedProjectDocs.map((file) => (
            <div key={file.path} className="flex items-center gap-1">
              <span className="text-xs">{file.name}</span>
              <button
                className="rounded-full bg-accent/20 hover:bg-accent/30"
                onClick={() =>
                  setSelectedProjectDocs((prev) =>
                    prev.filter((f) => f.path !== file.path)
                  )
                }
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
