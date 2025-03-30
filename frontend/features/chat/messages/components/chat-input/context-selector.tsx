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
import { ProjectFileExplorer } from "@/features/projects/components";
import { DocumentContent } from "@/types/project";
import { useAtom } from "jotai";
import { selectedProjectDocsAtom } from "@/atoms/chat";
import { toast } from "sonner";
import { useState } from "react";

interface ContextSelectorProps {
  showContextSelector: boolean;
  projectId?: string;
  selectedModel: { supportedMimeTypes?: string[] };
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

  const handleFileSelect = (item: DocumentContent) => {
    if (item.type === "file") {
      if (
        selectedModel.supportedMimeTypes &&
        item.mimeType &&
        !selectedModel.supportedMimeTypes.includes(item.mimeType)
      ) {
        toast.error(`Selected model does not support ${item.mimeType} files.`);
        return;
      }
      setSelectedProjectDocs((prev) =>
        prev.find((file) => file.path === item.path) ? prev : [...prev, item]
      );
      setShowFileExplorer(false);
    }
  };

  if (!showContextSelector) return null;

  return (
    <div className="flex items-center w-full h-5">
      <Button
        variant="ghost"
        className="text-xs px-2 font-normal text-muted-foreground hover:bg-transparent hover:text-accent-foreground"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowFileExplorer(true);
        }}
      >
        + Add context
      </Button>

      <Dialog open={showFileExplorer} onOpenChange={setShowFileExplorer}>
        <DialogContent className="max-w-[500px] h-auto max-h-[600px] md:max-w-[650px] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select files for context</DialogTitle>
            <DialogDescription>
              Choose files to add as context for your question
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-[500px]">
            <ScrollArea className="h-full w-full">
              <ProjectFileExplorer
                projectId={projectId}
                contentSource="project"
                variant="compact"
                onFileSelect={handleFileSelect}
              />
            </ScrollArea>
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
