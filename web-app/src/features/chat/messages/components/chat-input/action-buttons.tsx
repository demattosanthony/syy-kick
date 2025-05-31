import { Button } from "@/components/ui/button";
import { ArrowRight, File, Loader2, Paperclip, Square } from "lucide-react";
import ModelSelector from "../model-selector";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

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
  showSharePointPopoverButton?: boolean;
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
  showSharePointPopoverButton = true,
}: ActionButtonsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full flex justify-between items-center px-1 pb-1">
      <div className="flex items-center gap-1">
        <ModelSelector />
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
