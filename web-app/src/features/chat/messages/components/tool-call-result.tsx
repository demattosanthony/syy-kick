import { File, FileIcon, Search } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import MarkdownViewer from "./viewers/markdown-viewer";
import { useSetAtom, useAtom } from "jotai";
import {
  selectedArtifactAtom,
  alreadyAutoSelectedArtifactAtom,
  userClosedArtifactsAtom,
} from "@/atoms/chat";
import { Badge } from "@/components/ui/badge";
import { Artifact } from "@/types/chat";
import { useArtifactManagement } from "./hooks/use-artifact-management";
import {
  LoadingArtifactCard,
  StreamingArtifactCard,
  CompletedArtifactCard,
} from "./artifact-card";
import { parseToolArgs } from "./utils/artifact-utils";

type SharePointItem = {
  name: string;
  id: string;
  type: "file" | "folder";
  webUrl: string;
  lastModified?: string;
  size?: number;
};

const ToolCallMessageContent = ({ tool }: { tool: ToolInvocation }) => {
  switch (tool.toolName) {
    case "search_project_information":
    case "search_documents":
    case "search_projects_information":
    case "search_knowledge_base":
      return <SearchDocumentsTool tool={tool} />;
    case "web_search":
      return <WebSearchTool tool={tool} />;
    case "sharepoint_search":
      return <SharepointSearchTool tool={tool} />;
    case "sharepoint_ls":
      return <SharepointListTool tool={tool} />;
    case "sharepoint_open_file":
      return <SharepointOpenFileTool tool={tool} />;
    case "create_artifact":
      return <CreateArtifactTool tool={tool} />;
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
                      .map((_: any, idx: number) => (
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
                  if (result.projectId && result.path)
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
                      <img
                        src={getFaviconUrl(source) || ""}
                        alt=""
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

const SharepointSearchTool = ({ tool }: { tool: ToolInvocation }) => {
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResults = tool.state === "result" && tool.result?.files;
  const resultCount = hasResults ? tool.result.files.length : 0;
  //   const files = hasResults ? tool.result.files : [];

  if (loading) {
    return (
      <div className="w-fit max-w-3xl">
        <div className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                <img
                  src="/src/assets/logos/sharepoint.svg"
                  alt="SharePoint"
                  className="w-4 h-4 opacity-60"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Searching SharePoint for "{tool.args?.query}"
                </span>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to get file icon based on type
  const getFileIcon = (fileName: string, type: string) => {
    if (type === "folder") return "📁";
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📝";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📊";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "🖼️";
      default:
        return "📎";
    }
  };

  // SharePoint logo component using the actual SVG
  const SharePointIcon = ({
    className = "w-6 h-6",
  }: {
    className?: string;
  }) => (
    <img
      src="/src/assets/logos/sharepoint.svg"
      alt="SharePoint"
      className={className}
    />
  );

  // Don't show accordion if no results
  if (!hasResults || resultCount === 0) {
    return (
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between py-3 px-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <SharePointIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900">
                {tool.args?.query}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500">No results</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem
          value="sharepoint-search"
          className="overflow-hidden border-0"
        >
          <AccordionTrigger className="py-2 px-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:no-underline transition-colors duration-200 [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <SharePointIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-sm font-medium text-slate-900">
                  Searched: {tool.args?.query}
                </span>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs text-slate-600">
                  {resultCount} {resultCount === 1 ? "result" : "results"}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0 overflow-hidden">
            <div className="border-x border-b border-slate-200 rounded-b-lg bg-white">
              <div className="p-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tool.result?.files?.map(
                    (item: SharePointItem, idx: number) => (
                      <a
                        key={`result-${idx}`}
                        href={item.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group overflow-hidden"
                      >
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-white flex items-center justify-center text-sm">
                          {getFileIcon(item.name, item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="capitalize">{item.type}</span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>
                                  {(item.size / 1024 / 1024).toFixed(1)}MB
                                </span>
                              </>
                            )}
                            {item.lastModified && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    item.lastModified
                                  ).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </div>
                      </a>
                    )
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

const SharepointListTool = ({ tool }: { tool: ToolInvocation }) => {
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResults = tool.state === "result" && tool.result?.files;
  const resultCount = hasResults ? tool.result.files.length : 0;
  //   const files = hasResults ? tool.result.files : [];
  const path = tool.args?.path || "root";

  if (loading) {
    return (
      <div className="w-fit max-w-3xl">
        <div className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-lg animate-pulse">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center">
                <img
                  src="/src/assets/logos/sharepoint.svg"
                  alt="SharePoint"
                  className="w-4 h-4 opacity-60"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  Opening{" "}
                  {path === "root"
                    ? "SharePoint root directory"
                    : `folder: ${path}`}
                </span>
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to get file icon based on type
  const getFileIcon = (fileName: string, type: string) => {
    if (type === "folder") return "📁";
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📝";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📊";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "🖼️";
      default:
        return "📎";
    }
  };

  // SharePoint logo component
  const SharePointIcon = ({
    className = "w-6 h-6",
  }: {
    className?: string;
  }) => (
    <img
      src="/src/assets/logos/sharepoint.svg"
      alt="SharePoint"
      className={className}
    />
  );

  // Don't show accordion if no results
  if (!hasResults || resultCount === 0) {
    return (
      <div className="w-fit max-w-3xl">
        <div className="flex items-center justify-between py-3 px-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <SharePointIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-900">
                {path === "root"
                  ? "SharePoint Root Directory"
                  : `SharePoint: ${path}`}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500">Empty folder</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-fit max-w-3xl">
      <Accordion type="single" collapsible className="">
        <AccordionItem
          value="sharepoint-folder"
          className="overflow-hidden border-0"
        >
          <AccordionTrigger className="py-2 px-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:no-underline transition-colors duration-200 [&[data-state=open]]:rounded-b-none [&[data-state=open]]:border-b-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <SharePointIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <span className="text-sm font-medium text-slate-900">
                  {path === "root"
                    ? "SharePoint Root Directory"
                    : `SharePoint: ${path}`}
                </span>
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs text-slate-600">
                  {resultCount} {resultCount === 1 ? "item" : "items"}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0 overflow-hidden">
            <div className="border-x border-b border-slate-200 rounded-b-lg ">
              <div className="p-4">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tool.result?.files?.map(
                    (item: SharePointItem, idx: number) => (
                      <a
                        key={`result-${idx}`}
                        href={item.webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group overflow-hidden"
                      >
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-white flex items-center justify-center text-sm">
                          {getFileIcon(item.name, item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-600">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="capitalize">{item.type}</span>
                            {item.size && (
                              <>
                                <span>•</span>
                                <span>
                                  {(item.size / 1024 / 1024).toFixed(1)}MB
                                </span>
                              </>
                            )}
                            {item.lastModified && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    item.lastModified
                                  ).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </div>
                      </a>
                    )
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

const SharepointOpenFileTool = ({ tool }: { tool: ToolInvocation }) => {
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasContent =
    tool.state === "result" && tool.result && !(tool.result as any)?.error;
  const fileName =
    tool.state === "result"
      ? (tool.result as any)?.fileName || "Unknown file"
      : tool.args?.fileName || "Unknown file";
  const fileContent = hasContent ? (tool.result as any)?.content || "" : "";
  const webUrl = hasContent ? (tool.result as any)?.webUrl : undefined;
  const contentLength = fileContent.length;

  if (loading) {
    return (
      <div className="w-fit rounded-3xl border border-slate-200 bg-white p-2 cursor-default min-h-[34px] h-auto flex items-center gap-2 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
          <img
            src="/src/assets/logos/sharepoint.svg"
            alt="SharePoint"
            className="w-3 h-3 opacity-60"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">
            Reading{" "}
            {fileName.length > 20 ? fileName.substring(0, 20) : fileName}
          </span>
          <div className="flex space-x-1 pt-2">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to get file icon based on name
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📝";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📊";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "🖼️";
      default:
        return "📎";
    }
  };

  const formatContentSize = (length: number) => {
    if (length < 1000) return `${length} chars`;
    if (length < 1000000) return `${(length / 1000).toFixed(1)}K chars`;
    return `${(length / 1000000).toFixed(1)}M chars`;
  };

  if (tool.state === "result" && (tool.result as any)?.error) {
    return (
      <div className="w-fit rounded-3xl border border-red-200 bg-red-50 p-2 cursor-default min-h-[34px] h-auto flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg
            className="w-3.5 h-3.5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <span className="text-sm text-red-700">
          SharePoint Error: {(tool.result as any).error}
        </span>
      </div>
    );
  }

  if (!webUrl) {
    return (
      <div className="w-fit rounded-3xl border border-border p-2 cursor-default hover:bg-secondary/30 transition-colors duration-200 min-h-[34px] h-auto flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs">
          {getFileIcon(fileName)}
        </div>
        <span className="text-sm text-muted-foreground">{fileName}</span>
        {contentLength > 0 && (
          <>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {formatContentSize(contentLength)}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 hover:border-primary/20 transition-all duration-200 min-h-[34px] h-auto flex items-center gap-1 group"
    >
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-colors">
        <FileIcon className="w-4 h-4 " />
      </div>
      <span className="text-sm font-medium text-slate-900 group-hover:text-primary transition-colors">
        {fileName}
      </span>
      {contentLength > 0 && (
        <>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatContentSize(contentLength)}
          </span>
        </>
      )}
      <div className="text-slate-400 group-hover:text-primary transition-colors">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>
    </a>
  );
};

const CreateArtifactTool = ({ tool }: { tool: ToolInvocation }) => {
  // This hook handles automatic artifact streaming and selection
  useArtifactManagement(tool);

  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);

  const hasArgs = tool.args && Object.keys(tool.args).length > 0;
  const isComplete = tool.state === "result" && !!(tool as any).result;
  const isStreaming = tool.state === "partial-call" || tool.state === "call";
  const hasStreamingText =
    (tool as any).argsText && (tool as any).argsText.length > 0;

  // Show initial loading state
  if (isStreaming && !hasStreamingText && !hasArgs) {
    return <LoadingArtifactCard />;
  }

  // Show streaming progress
  if (isStreaming && (hasStreamingText || hasArgs)) {
    const { content, title, type } = parseToolArgs(tool, hasArgs);

    const handleStreamingClick = () => {
      const streamingIdentifier = `streaming-${tool.toolCallId || Date.now()}`;
      const streamingArtifact: Artifact = {
        identifier: streamingIdentifier,
        type: type || "text/markdown",
        title: title || "Untitled Artifact",
        content: content || "",
        isComplete: false,
      };
      setSelectedArtifact(streamingArtifact);
    };

    return (
      <StreamingArtifactCard
        title={title}
        type={type}
        onClick={handleStreamingClick}
      />
    );
  }

  // Show completed artifact
  if (isComplete) {
    const artifactData = (tool as any).result as {
      identifier: string;
      type: string;
      title: string;
      content: string;
    };

    const artifact: Artifact = {
      identifier: artifactData.identifier,
      type: artifactData.type,
      title: artifactData.title,
      content: artifactData.content,
      isComplete: true,
    };

    return (
      <CompletedArtifactCard
        artifact={artifact}
        onClick={() => setSelectedArtifact(artifact)}
      />
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Failed to create artifact
    </div>
  );
};

export default ToolCallMessageContent;
