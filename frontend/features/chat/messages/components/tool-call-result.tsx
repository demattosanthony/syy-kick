import { File, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";
import { ToolInvocation } from "ai";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader } from "@/components/ui/loader";
import Image from "next/image";

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
  const [open, setOpen] = React.useState(false);
  const hasResults = tool.state === "result" && tool.result;
  const resultCount = hasResults ? tool.result.dataForFrontend.length : 0;

  // Show loading state
  if (tool.state === "partial-call" || tool.state === "call") {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text="Searching project information..."
          size="lg"
        />
      </div>
    );
  }

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
              {resultCount > 0 ? (
                <>
                  {/* Show first 3 file icons */}
                  <div className="flex -space-x-1">
                    {tool.result.dataForFrontend
                      .slice(0, 3)
                      .map((result: { source: string }, idx: number) => (
                        <div
                          key={`file-icon-${idx}`}
                          className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                        >
                          <File className="w-3 h-3 text-muted-foreground" />
                        </div>
                      ))}
                  </div>

                  <span className="font-normal text-sm">
                    {resultCount} {resultCount === 1 ? "source" : "sources"}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Search className="w-3 h-3 text-muted-foreground" />
                  <span className="font-normal text-sm text-muted-foreground">
                    No results found
                  </span>
                </div>
              )}
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
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
          {tool.result.dataForFrontend.map(
            (
              result: {
                path: string;
                projectId: string;
                page?: number;
                source: string;
                snippet: string;
              },
              idx: number
            ) => (
              <div
                key={`result-${idx}`}
                className="flex flex-col gap-3 cursor-pointer hover:bg-secondary p-3 rounded-lg transition-colors duration-200"
                onClick={() => {
                  window.open(
                    `/projects/${result.projectId}/blob/${result.path}${
                      result.page ? `?page=${result.page}` : ""
                    }`,
                    "_blank"
                  );
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex-shrink-0">
                    <Avatar className="w-full h-full">
                      <AvatarFallback>📑</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {result.source}
                    </div>
                    {result.page && (
                      <span className="text-xs text-muted-foreground">
                        Page {result.page}
                      </span>
                    )}
                  </div>
                </div>
                {result.snippet && (
                  <div className="text-xs text-muted-foreground line-clamp-5">
                    {result.snippet}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const WebSearchTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const hasResults = tool.state === "result" && tool.result;

  // New response format handling
  const toolResponse = hasResults ? tool.result : undefined;
  const sources = toolResponse?.sources || [];
  const resultCount = sources.length;
  const queries = toolResponse?.queries || [];

  // Show loading state
  if (tool.state === "partial-call" || tool.state === "call") {
    return (
      <div className="">
        <Loader variant="text-shimmer" text="Searching the web..." size="lg" />
      </div>
    );
  }

  // Format URL for display
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.origin.replace(/^https?:\/\//, "").replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  };

  // Get favicon URL based on source information
  const getFaviconUrl = (source: any) => {
    try {
      // First try to use the title if it looks like a domain
      if (source.title && source.title.includes(".")) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
          source.title
        )}&sz=32`;
      }

      // Fall back to the URL
      const url = getSourceUrl(source);
      const urlObj = new URL(url);

      // Handle redirect URLs
      if (
        urlObj.hostname.includes("vertexaisearch.cloud.google.com") ||
        urlObj.pathname.includes("grounding-api-redirect")
      ) {
        // We can't get a good favicon for redirect URLs without a domain title
        return null;
      }

      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        urlObj.hostname
      )}&sz=32`;
    } catch (e) {
      console.error("Error getting favicon:", e);
      return null;
    }
  };
  // Handle different source formats
  const getSourceUrl = (source: any): string => {
    if (typeof source === "string") {
      return source;
    } else if (source && source.url) {
      return source.url;
    }
    return "";
  };

  const getSourceTitle = (source: any): string => {
    if (typeof source === "string") {
      return formatUrl(source);
    } else if (source && source.title) {
      return source.title;
    } else if (source && source.url) {
      return formatUrl(source.url);
    }
    return "Unknown source";
  };

  // Format text with citations
  const formatTextWithCitations = (text: string) => {
    if (!text) return "";

    // Replace markdown list items with styled HTML
    let formattedText = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    formattedText = formattedText.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Add source references if available
    if (sources.length > 0) {
      // Create a map of source titles to their indices
      const sourceTitleMap = new Map();
      sources.forEach((source: any, index: number) => {
        const sourceTitle = getSourceTitle(source);
        if (sourceTitle) {
          sourceTitleMap.set(sourceTitle.toLowerCase(), index + 1);
        }
      });

      // Process the text to find matches and insert citations
      const words = formattedText.split(" ");
      const processedWords = words.map((word) => {
        // Strip punctuation for matching but keep it for replacement
        const strippedWord = word.replace(/[.,;:!?()]/g, "").toLowerCase();
        const sourceCitations: number[] = [];

        sourceTitleMap.forEach((sourceNumber, sourceTitle) => {
          if (
            strippedWord === sourceTitle ||
            sourceTitle.includes(strippedWord)
          ) {
            sourceCitations.push(sourceNumber);
          }
        });

        if (sourceCitations.length > 0) {
          // Add citation references at the end of the word
          const citations = sourceCitations.map((num) => `[${num}]`).join("");
          return word + "<sup>" + citations + "</sup>";
        }
        return word;
      });

      formattedText = processedWords.join(" ");
    }

    return formattedText;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div
          className={cn(
            "w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center"
          )}
        >
          {hasResults && sources.length > 0 ? (
            <div className="flex items-center gap-2">
              {/* Show first 3 favicons */}
              <div className="flex -space-x-1">
                {sources.slice(0, 3).map((source: any, idx: number) => {
                  const url = getSourceUrl(source);
                  return (
                    <div
                      key={`favicon-${idx}`}
                      className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                    >
                      {url ? (
                        <Image
                          src={getFaviconUrl(source) || ""} // Pass the entire source object
                          alt=""
                          width={16}
                          height={16}
                          className="w-3 h-3"
                          onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = "none";
                            const fallback =
                              e.currentTarget.parentElement?.querySelector(
                                ".fallback-icon"
                              );
                            // if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : (
                        <Search className="w-3 h-3 text-muted-foreground" />
                      )}
                      <div className="fallback-icon hidden items-center justify-center w-full h-full">
                        <Search className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <span className="font-normal text-sm">
                {resultCount} web {resultCount === 1 ? "source" : "sources"}
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
        </SheetHeader>

        <div className="flex flex-col gap-4 h-[calc(100vh-180px)] overflow-hidden mt-4">
          {/* Main content area with overflow */}
          <div className="flex-1 overflow-y-auto pr-2">
            {/* Display the main text result with citations */}
            {toolResponse?.text && (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-secondary/30 mb-6">
                {/* Show search queries used */}
                {queries && queries.length > 0 && (
                  <div className="border-b border-border pb-3 mb-3">
                    <h4 className="text-xs uppercase font-medium text-muted-foreground mb-2">
                      Search Queries
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {queries.map((query: string, idx: number) => (
                        <div
                          key={`query-${idx}`}
                          className="text-xs bg-secondary/40 rounded-full px-3 py-1"
                        >
                          {query}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: formatTextWithCitations(toolResponse.text),
                  }}
                />

                {/* Citation legend if needed */}
                {sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <h4 className="text-xs font-medium mb-1">Citations</h4>
                    <div className="text-xs text-muted-foreground">
                      {sources.map((source: any, idx: number) => (
                        <div key={`citation-${idx}`} className="mb-1">
                          <sup>[{idx + 1}]</sup> {getSourceTitle(source)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Display sources in a more structured way */}
            {sources.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs uppercase font-medium text-muted-foreground mb-3">
                  Sources
                </h4>
                <div className="grid gap-3">
                  {sources.map((source: any, idx: number) => {
                    const url = getSourceUrl(source);
                    const title = getSourceTitle(source);

                    return (
                      <div
                        key={`result-${idx}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary cursor-pointer transition-colors duration-200"
                        onClick={() => window.open(url, "_blank")}
                      >
                        <div className="w-8 h-8 flex-shrink-0">
                          <Avatar className="w-full h-full">
                            <AvatarImage
                              src={getFaviconUrl(source) || ""}
                              alt=""
                            />
                            <AvatarFallback className="bg-secondary/70">
                              <Search className="w-4 h-4 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {formatUrl(url)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ToolCallMessageContent;
