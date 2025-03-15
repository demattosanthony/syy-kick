import { File, Search, ChevronDown } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { cn } from "@/lib/utils";
import React from "react";
import { ToolInvocation } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { Loader } from "@/components/ui/loader";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ToolCallMessageContent = ({ tool }: { tool: ToolInvocation }) => {
  switch (tool.toolName) {
    case "search_project_information":
    case "search_documents":
    case "search_projects_information":
      return <SearchDocumentsTool tool={tool} />;
    case "web_search":
      return <WebSearchTool tool={tool} />;
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
        "w-full max-w-full rounded-lg border border-border p-3",
        (tool.state === "partial-call" || tool.state === "call") &&
          "animate-border-pulse"
      )}
    >
      {/* Search Query Section */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-fit">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Searching for:</span>
        </div>
        <span className="font-medium break-words">{tool.args?.query}</span>
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

const WebSearchTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const hasResults = tool.state === "result" && tool.result;
  const resultCount = hasResults ? tool.result.length : 0;

  if (tool.state === "partial-call" || tool.state === "call") {
    return (
      <div key={"text-shimmer"} className="">
        <Loader
          variant={"text-shimmer"}
          text="Searching the web..."
          size="lg"
        />
      </div>
    );
  }

  console.log("tool.result", tool.result);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div
          className={cn(
            "w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center"
          )}
        >
          {hasResults ? (
            <div className="flex items-center gap-2">
              {/* Show first 3 favicons */}
              <div className="flex -space-x-1">
                {tool.result
                  .slice(0, 3)
                  .map((result: { favicon?: string }, idx: number) => (
                    <div
                      key={`favicon-${idx}`}
                      className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                    >
                      {result.favicon ? (
                        <img src={result.favicon} alt="" className="w-3 h-3" />
                      ) : (
                        <Search className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                  ))}
              </div>

              {/* Show total number of web pages */}
              <span className="font-normal text-sm">
                {resultCount} web pages
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Searching for:</span>
              <span className="font-medium max-w-[300px] truncate">
                {tool.args?.query}
              </span>
            </div>
          )}
        </div>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Search Results</SheetTitle>
          <SheetDescription>Results for "{tool.args?.query}"</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto  mt-4">
          {tool.result.map(
            (
              result: {
                url: string;
                title: string;
                text: string;
                summary: string;
                favicon?: string;
                image?: string;
              },
              idx: number
            ) => (
              <div
                key={`result-${idx}`}
                className="flex flex-col gap-2 cursor-pointer hover:bg-secondary p-3 rounded-lg transition-colors duration-200"
                onClick={() => window.open(result.url, "_blank")}
              >
                <small className="text-sm font-bold leading-none">
                  {result.title}
                </small>
                <p className="text-sm line-clamp-3">{result.summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-5 h-5 flex-shrink-0">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={result.favicon} alt="" />
                      <AvatarFallback>
                        <Search className="w-full h-full text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {(() => {
                      try {
                        const url = new URL(result.url);
                        // Remove https://, http://, and www. from the origin
                        return url.origin
                          .replace(/^https?:\/\//, "")
                          .replace(/^www\./, "");
                      } catch (e) {
                        return result.url;
                      }
                    })()}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ToolCallMessageContent;
