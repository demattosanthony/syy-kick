import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "@/features/chat/messages/components";
import { CsvViewer } from "@/features/chat/messages/components/viewers/artifact-viewer";
import { useCsvActions } from "@/hooks/use-csv-actions";
import { extractSpecialContent } from "@/lib/artifact-utils";
import { Check, Loader2 } from "lucide-react";

interface OutputDisplayProps {
  response: any;
  outputConfig: any;
  status: string;
}

/** OutputDisplay: Renders the workflow output based on configuration */
function OutputDisplay({ response, outputConfig, status }: OutputDisplayProps) {
  const { downloadCsv, previewCsv } = useCsvActions();
  const { artifact } = extractSpecialContent(response?.content || "");

  if (!artifact?.content) return null;

  const isStreaming = status === "streaming";

  return (
    <div className="bg-card rounded-xl p-6 shadow-lg border">
      <div className="flex items-center gap-3 mb-6">
        {isStreaming ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold">Generating output...</h3>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600">
              <Check />
            </div>
            <h3 className="text-xl font-semibold">
              Run completed successfully
            </h3>
          </>
        )}
      </div>
      <div className="space-y-4">
        {outputConfig.type === "csv" || outputConfig.type === "table" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{outputConfig.title || "Results"}</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(artifact.content)}
                >
                  Download CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    previewCsv(
                      artifact.content,
                      outputConfig.title || "CSV Results"
                    )
                  }
                >
                  View Full Screen
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto border rounded">
              <div className="min-w-max">
                <CsvViewer content={artifact.content} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{outputConfig.title || "Results"}</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([artifact.content], {
                      type: "text/markdown",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${outputConfig.title || "markdown"}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Markdown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Open markdown in a new tab instead of using previewCsv
                    const blob = new Blob([artifact.content], {
                      type: "text/markdown",
                    });
                    const url = URL.createObjectURL(blob);
                    const newTab = window.open(url, "_blank");
                    // Clean up the URL object when the new tab is closed
                    if (newTab) {
                      newTab.addEventListener("beforeunload", () => {
                        URL.revokeObjectURL(url);
                      });
                    }
                  }}
                >
                  View Full Screen
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto border rounded-lg">
              <div className="prose prose-sm max-w-none p-6">
                <MarkdownViewer content={artifact.content} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OutputDisplay;
