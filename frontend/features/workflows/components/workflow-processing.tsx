import { Loader } from "@/components/ui/loader";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef } from "react";

interface ProcessingIndicatorProps {
  reasoning?: string;
  showReasoning: boolean;
  onToggleReasoning: () => void;
}

/** ProcessingIndicator: Displays loading state and reasoning during workflow execution */
function ProcessingIndicator({
  reasoning,
  showReasoning,
  onToggleReasoning,
}: ProcessingIndicatorProps) {
  const reasoningContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reasoningContainerRef.current && showReasoning && reasoning) {
      setTimeout(() => {
        if (reasoningContainerRef.current) {
          reasoningContainerRef.current.scrollTop =
            reasoningContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [reasoning, showReasoning]);

  return (
    <div className="bg-card rounded-xl p-8 shadow-lg border flex flex-col items-center justify-center">
      <Loader className="h-12 w-12 mb-4" variant="circular" />
      <h3 className="text-xl font-semibold mb-2">Processing your files</h3>
      <p className="text-muted-foreground text-center">
        Please wait while the workflow is running. This may take a few moments.
      </p>
      {reasoning && (
        <div className="mt-8 w-full">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-sm">Processing details</h4>
            <button
              onClick={onToggleReasoning}
              className="text-xs flex items-center text-muted-foreground hover:text-foreground"
            >
              {showReasoning ? (
                <>
                  Hide <ChevronUp className="ml-1 h-3 w-3" />
                </>
              ) : (
                <>
                  Show <ChevronDown className="ml-1 h-3 w-3" />
                </>
              )}
            </button>
          </div>
          {showReasoning && (
            <div
              ref={reasoningContainerRef}
              className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground overflow-y-auto max-h-[300px] font-mono whitespace-pre-wrap"
            >
              {reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProcessingIndicator;
