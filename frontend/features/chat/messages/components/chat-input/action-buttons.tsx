import { Button } from "@/components/ui/button";
import { ArrowRight, Paperclip, Square } from "lucide-react";
import ModelSelector from "../model-selector";

interface ActionButtonsProps {
  isGenerating?: boolean;
  input: string;
  stop?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  selectedModel: { supportedMimeTypes?: string[] };
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ActionButtons({
  isGenerating,
  input,
  stop,
  onSubmit,
  selectedModel,
  fileInputRef,
  handleFiles,
}: ActionButtonsProps) {
  return (
    <div className="w-full flex justify-between items-center px-1 pb-1">
      <div>
        <ModelSelector />
      </div>
      <div className="flex items-center gap-1 h-full">
        {selectedModel.supportedMimeTypes &&
          selectedModel.supportedMimeTypes.length > 0 && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={selectedModel.supportedMimeTypes?.join(",")}
                multiple
                onChange={handleFiles}
              />
              <Button
                className="h-7 w-7 p-0 rounded-full"
                variant="ghost"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef?.current?.click();
                }}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
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
