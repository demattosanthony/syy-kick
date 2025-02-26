import {
  File,
  Search,
  ChevronDown,
  Loader2,
  Maximize,
  Minimize,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import React from "react";
import { ToolInvocation } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import MarkdownViewer from "../viewers/markdown-viewer";
import { Button } from "../ui/button";
import { useAtom } from "jotai";
import { selectedArtifactAtom } from "@/atoms/chat";

export const ToolCallMessageContent = ({ tool }: { tool: ToolInvocation }) => {
  switch (tool.toolName) {
    case "search_project_information":
      return <SearchDocumentsTool tool={tool} />;
    case "create_document":
      return <CreateDocumentTool tool={tool} />;

    default:
      return null;
  }
};

const SearchDocumentsTool = ({ tool }: { tool: ToolInvocation }) => {
  const [showAll, setShowAll] = React.useState(false);
  const hasResults = tool.state === "result" && tool.result;
  const resultCount = hasResults ? tool.result.dataForFrontend.length : 0;

  return (
    <div
      className={cn(
        "w-fit rounded-lg border border-border p-3",
        (tool.state === "partial-call" || tool.state === "call") &&
          "animate-border-pulse"
      )}
    >
      {/* Search Query Section */}
      <div className="flex items-center gap-2 text-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Searching for:</span>
        <span className="font-medium max-w-[500px] truncate">
          {tool.args?.query}
        </span>
      </div>

      {/* Results Section */}
      {hasResults && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Found {resultCount} relevant{" "}
              {resultCount === 1 ? "source" : "sources"}:
            </div>
            {resultCount > 3 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                <span>{showAll ? "Show less" : "Show all"}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-200 ${
                    showAll ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            <motion.div className="flex gap-2 flex-wrap max-w-3xl" layout>
              {tool.result.dataForFrontend
                .slice(0, showAll ? undefined : 3)
                .map(
                  (
                    result: {
                      path: string;
                      projectId: string;
                      page?: number;
                      source: string;
                    },
                    idx: number
                  ) => (
                    <motion.div
                      key={`result-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      layout
                    >
                      <Badge
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal cursor-pointer w-fit max-w-[200px] hover:bg-secondary/60 transition-colors duration-200"
                        variant={"secondary"}
                        onClick={() => {
                          window.open(
                            `/projects/${result.projectId}/blob/${result.path}${
                              result.page ? `?page=${result.page}` : ""
                            }`,
                            "_blank"
                          );
                        }}
                        title={`${result.source}${
                          result.page ? ` (page ${result.page})` : ""
                        }`}
                      >
                        <File className="w-4 h-4 min-w-[12px]" />
                        <div className="flex flex-col w-full truncate">
                          <span className="truncate">{result.source}</span>
                          {result.page && (
                            <span className="text-xs opacity-75">
                              Page {result.page}
                            </span>
                          )}
                        </div>
                      </Badge>
                    </motion.div>
                  )
                )}

              {!showAll && resultCount > 3 && (
                <motion.div
                  key="more-badge"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <Badge
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal cursor-pointer hover:bg-secondary/60 transition-colors duration-200"
                    variant="secondary"
                    onClick={() => setShowAll(true)}
                  >
                    +{resultCount - 3} more
                  </Badge>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

const CreateDocumentTool = ({ tool }: { tool: ToolInvocation }) => {
  const documentTitle = tool.args?.title;
  const documentContent = tool.args?.content;
  const isStreaming = tool.state === "partial-call" || tool.state === "call";
  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);

  const isSelectedArtifact = selectedArtifact?.id === tool.toolCallId;

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          "rounded-lg border border-border overflow-hidden my-2",
          isSelectedArtifact ? "w-auto" : "w-fit"
        )}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {/* Document Header */}
        <div className="flex items-center justify-between bg-secondary/40 p-3">
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <File className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm truncate max-w-[400px]">
              {documentTitle || "Untitled Document"}
            </span>
          </div>
          <Button
            className="hover:bg-secondary rounded-sm transition-colors"
            title={isSelectedArtifact ? "Minimize" : "Expand full screen"}
            variant={"ghost"}
            size={"icon"}
            onClick={() => {
              if (isSelectedArtifact) {
                setSelectedArtifact(null);
              } else {
                setSelectedArtifact({
                  id: tool.toolCallId,
                  title: documentTitle || "Untitled Document",
                  content: documentContent || "",
                });
              }
            }}
          >
            {isSelectedArtifact ? (
              <Minimize className="w-4 h-4" />
            ) : (
              <Maximize className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Document Content Preview - only show if not selected */}
        {!isSelectedArtifact && (
          <motion.div
            className="p-4 max-h-[320px] overflow-y-auto bg-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <MarkdownViewer initialContent={documentContent} editable />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default SearchDocumentsTool;
