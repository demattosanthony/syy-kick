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
import MarkdownViewer from "./viewers/markdown-viewer";

const ToolCallMessageContent = ({ tool }: { tool: ToolInvocation }) => {
  switch (tool.toolName) {
    case "search_project_information":
    case "search_documents":
    case "search_projects_information":
    case "search_knowledge_base":
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
  const resultCount =
    hasResults && tool.result?.dataForFrontend
      ? tool.result.dataForFrontend.length
      : 0;

  // Show loading state
  if (tool.state === "partial-call" || tool.state === "call") {
    let loadingText = "Searching project information...";

    if (tool.toolName === "search_knowledge_base") {
      loadingText = "Searching knowledge base...";
    }

    return (
      <div className="">
        <Loader variant="text-shimmer" text={loadingText} size="lg" />
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
          {tool.result.dataForFrontend?.map(
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
  const toolResponse = hasResults ? tool.result : undefined;
  const sources: Array<string | { url?: string; title?: string }> =
    toolResponse?.sources || [];
  const resultCount = sources.length;
  const queries: string[] = toolResponse?.queries || [];

  if (tool.state === "partial-call" || tool.state === "call") {
    return (
      <Loader variant="text-shimmer" text="Searching the web..." size="lg" />
    );
  }

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.origin.replace(/^https?:\/\//, "").replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  };

  const getSourceUrl = (source: any): string =>
    typeof source === "string" ? source : source?.url || "";

  const getSourceTitle = (source: any): string => {
    if (typeof source === "string") return formatUrl(source);
    if (source?.title) return source.title;
    if (source?.url) return formatUrl(source.url);
    return "Unknown source";
  };

  const getFaviconUrl = (source: any) => {
    try {
      if (source.title?.includes(".")) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
          source.title
        )}&sz=32`;
      }
      const url = getSourceUrl(source);
      const urlObj = new URL(url);
      if (
        urlObj.hostname.includes("vertexaisearch.cloud.google.com") ||
        urlObj.pathname.includes("grounding-api-redirect")
      ) {
        return null;
      }
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        urlObj.hostname
      )}&sz=32`;
    } catch (e) {
      return null;
    }
  };

  // Clean text content by removing the "Sources" section if it exists
  const cleanTextContent = (text: string): string => {
    // Regular expression to match the "Sources" section at the end of the text
    const sourcesRegex = /\n+## Sources\n([\s\S]*?)$/;
    return text.replace(sourcesRegex, "");
  };

  // Process inline citations to make them clickable
  const processCitations = (text: string): string => {
    if (!text || !sources.length) return text;

    // Regular expression to find citation patterns like [1], [2], etc.
    // Using a regex with lookahead and lookbehind to avoid replacing citations inside markdown links
    const citationRegex = /(?<!\]\()(\[\d+\])(?!\))/g;

    return text.replace(citationRegex, (match) => {
      // Extract the number from [n]
      const numMatch = match.match(/\[(\d+)\]/);
      if (!numMatch) return match;

      const sourceIndex = parseInt(numMatch[1]) - 1;
      if (sourceIndex < 0 || sourceIndex >= sources.length) return match;

      const source = sources[sourceIndex];
      const url = getSourceUrl(source);

      // Only convert to link if we have a valid URL
      if (!url) return match;

      // Create a markdown link
      return `[${match}](${url})`;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center">
          {hasResults && sources.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {sources.slice(0, 3).map((source, idx) => (
                  <div
                    key={`favicon-${idx}`}
                    className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                  >
                    {getSourceUrl(source) ? (
                      <Image
                        src={getFaviconUrl(source) || ""}
                        alt=""
                        width={16}
                        height={16}
                        className="w-3 h-3"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <Search className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
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
        <div className="flex flex-col gap-4 h-[calc(100vh-100px)] overflow-hidden mt-4">
          <div className="flex-1 overflow-y-auto pr-2">
            {toolResponse?.text && (
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-secondary/30 mb-6">
                {queries?.length > 0 && (
                  <div className="border-b border-border pb-3 mb-3">
                    <h4 className="text-xs uppercase font-medium text-muted-foreground mb-2">
                      Search Queries
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {queries.map((query, idx) => (
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
                <div className="text-sm prose prose-sm max-w-none">
                  <MarkdownViewer
                    content={processCitations(
                      cleanTextContent(toolResponse.text)
                    )}
                  />
                </div>
                {sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <h4 className="text-xs uppercase font-medium text-muted-foreground mb-3">
                      Sources
                    </h4>
                    <div className="grid gap-2.5">
                      {sources.map((source, idx) => {
                        const url = getSourceUrl(source);
                        const title = getSourceTitle(source);
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            id={`source-${idx}`}
                            key={`source-${idx}`}
                            className="flex items-center gap-3 p-2.5 rounded-md hover:bg-primary/10 hover:text-primary transition-colors duration-150 group relative pl-8"
                          >
                            <div className="absolute left-0 w-6 h-6 flex items-center justify-center">
                              <div className="font-semibold text-xs group-hover:text-primary">
                                [{idx + 1}]
                              </div>
                            </div>
                            <div className="w-5 h-5 flex-shrink-0">
                              <Avatar className="w-full h-full">
                                <AvatarImage
                                  src={getFaviconUrl(source) || ""}
                                  alt=""
                                />
                                <AvatarFallback className="bg-secondary/70">
                                  <Search className="w-3 h-3 text-muted-foreground" />
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate group-hover:underline">
                                {title}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {formatUrl(url)}
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ToolCallMessageContent;
