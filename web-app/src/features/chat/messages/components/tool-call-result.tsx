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
  const [showDebug, setShowDebug] = React.useState(false);
  const hasResults = tool.state === "result" && tool.result;
  const toolResponse = hasResults ? tool.result : undefined;
  const sources: Array<{ url?: string; title?: string; snippet?: string }> =
    toolResponse?.sources || [];
  const resultCount = sources.length;

  if (tool.state === "partial-call" || tool.state === "call") {
    return (
      <Loader variant="text-shimmer" text="Searching the web..." size="lg" />
    );
  }

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  };

  const getSourceUrl = (source: any): string => source?.url || "";

  const getSourceTitle = (source: any): string => {
    if (
      source?.title &&
      source.title !== `Source ${sources.indexOf(source) + 1}`
    ) {
      return source.title;
    }
    if (source?.url) {
      return formatUrl(source.url);
    }
    return "Unknown source";
  };

  const getFaviconUrl = (source: any) => {
    try {
      const url = getSourceUrl(source);
      if (!url) return null;
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        urlObj.hostname
      )}&sz=32`;
    } catch (e) {
      return null;
    }
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
          <SheetTitle>Web Search Results</SheetTitle>
          <SheetDescription>
            Results for "{tool.args?.query}"
            {tool.args?.specific_domain && (
              <span className="text-muted-foreground">
                {" "}
                from {tool.args.specific_domain}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 h-[calc(100vh-100px)] overflow-hidden mt-4">
          {/* Debug toggle button */}
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-muted-foreground">
              {sources.length} {sources.length === 1 ? "Source" : "Sources"}
            </h3>
            {toolResponse?.text && (
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs px-2 py-1 bg-secondary/50 hover:bg-secondary rounded-md transition-colors"
              >
                {showDebug ? "Hide Debug" : "Show Debug"}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {showDebug && toolResponse?.text ? (
              <div className="mb-6 p-4 rounded-lg bg-secondary/30 border">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Full Text (Model Input)
                </h4>
                <div className="text-xs bg-secondary/50 rounded p-3 max-h-[calc(100vh-400px)] overflow-y-auto font-mono whitespace-pre-wrap">
                  {toolResponse.text}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((source, idx) => {
                  const url = getSourceUrl(source);
                  const title = getSourceTitle(source);
                  if (!url) return null;

                  return (
                    <button
                      key={`source-${idx}`}
                      onClick={() =>
                        window.open(url, "_blank", "noopener,noreferrer")
                      }
                      className="w-full flex items-center gap-3 p-4 rounded-lg border border-border hover:border-primary/20 hover:bg-primary/5 transition-all duration-200 group text-left"
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
                        <div className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                          {title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 mb-2">
                          {formatUrl(url)}
                        </div>
                        {source.snippet && (
                          <div className="text-xs text-muted-foreground line-clamp-3">
                            {source.snippet}
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
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
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SharepointSearchTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResults = tool.state === "result" && tool.result?.files;
  const resultCount = hasResults ? tool.result.files.length : 0;

  if (loading) {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text={`Searching SharePoint for "${tool.args?.query}"`}
          size="lg"
        />
      </div>
    );
  }

  // SharePoint logo component
  const SharePointIcon = ({
    className = "w-5 h-5",
  }: {
    className?: string;
  }) => (
    <img
      src="/src/assets/logos/sharepoint.svg"
      alt="SharePoint"
      className={className}
    />
  );

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div
          className={cn(
            "w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center"
          )}
        >
          {hasResults && resultCount > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {tool.result.files.slice(0, 3).map((_: any, idx: number) => (
                  <div
                    key={`file-icon-${idx}`}
                    className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                  >
                    <SharePointIcon className="w-3 h-3" />
                  </div>
                ))}
              </div>
              <span className="font-normal text-sm">
                {resultCount} SharePoint{" "}
                {resultCount === 1 ? "result" : "results"}
              </span>
            </div>
          ) : hasResults ? (
            <div className="flex items-center gap-2">
              <Search className="w-3 h-3 text-muted-foreground" />
              <span className="font-normal text-sm text-muted-foreground">
                No SharePoint results found
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <SharePointIcon className="w-3.5 h-3.5" />
              <span className="text-muted-foreground">
                Searching SharePoint for:
              </span>
              <span className="font-medium max-w-[300px] truncate">
                {tool.args?.query}
              </span>
            </div>
          )}
        </div>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>SharePoint Search Results</SheetTitle>
          <SheetDescription>Results for "{tool.args?.query}"</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
          {tool.result?.files?.map((item: SharePointItem, idx: number) => (
            <div
              key={`result-${idx}`}
              className="flex flex-col gap-3 cursor-pointer hover:bg-secondary p-3 rounded-lg transition-colors duration-200"
              onClick={() =>
                window.open(item.webUrl, "_blank", "noopener,noreferrer")
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex-shrink-0">
                  <Avatar className="w-full h-full">
                    <AvatarFallback>
                      {getFileIcon(item.name, item.type)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="capitalize">{item.type}</span>
                    {item.lastModified && (
                      <>
                        <span>•</span>
                        <span>
                          {new Date(item.lastModified).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SharepointListTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResults = tool.state === "result" && tool.result?.files;
  const resultCount = hasResults ? tool.result.files.length : 0;
  const path = tool.args?.path || "root";

  if (loading) {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text={
            path === "root"
              ? "Opening SharePoint root directory..."
              : `Opening SharePoint folder: ${path}...`
          }
          size="lg"
        />
      </div>
    );
  }

  // SharePoint logo component
  const SharePointIcon = ({
    className = "w-5 h-5",
  }: {
    className?: string;
  }) => (
    <img
      src="/src/assets/logos/sharepoint.svg"
      alt="SharePoint"
      className={className}
    />
  );

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div
          className={cn(
            "w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center"
          )}
        >
          {hasResults && resultCount > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1">
                {tool.result.files.slice(0, 3).map((_: any, idx: number) => (
                  <div
                    key={`file-icon-${idx}`}
                    className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden"
                  >
                    <SharePointIcon className="w-3 h-3" />
                  </div>
                ))}
              </div>
              <span className="font-normal text-sm">
                {resultCount} {resultCount === 1 ? "item" : "items"}
              </span>
            </div>
          ) : hasResults ? (
            <div className="flex items-center gap-2">
              <SharePointIcon className="w-3 h-3 text-muted-foreground" />
              <span className="font-normal text-sm text-muted-foreground">
                Empty folder
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <SharePointIcon className="w-3.5 h-3.5" />
              <span className="text-muted-foreground">Opening:</span>
              <span className="font-medium max-w-[300px] truncate">
                {path === "root" ? "SharePoint Root" : path}
              </span>
            </div>
          )}
        </div>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {path === "root"
              ? "SharePoint Root Directory"
              : `SharePoint: ${path}`}
          </SheetTitle>
          <SheetDescription>
            {resultCount} {resultCount === 1 ? "item" : "items"} in this
            directory
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
          {tool.result?.files?.map((item: SharePointItem, idx: number) => (
            <div
              key={`result-${idx}`}
              className="flex flex-col gap-3 cursor-pointer hover:bg-secondary p-3 rounded-lg transition-colors duration-200"
              onClick={() =>
                window.open(item.webUrl, "_blank", "noopener,noreferrer")
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex-shrink-0">
                  <Avatar className="w-full h-full">
                    <AvatarFallback>
                      {getFileIcon(item.name, item.type)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="capitalize">{item.type}</span>
                    {item.lastModified && (
                      <>
                        <span>•</span>
                        <span>
                          {new Date(item.lastModified).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SharepointOpenFileTool = ({ tool }: { tool: ToolInvocation }) => {
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasContent =
    tool.state === "result" && tool.result && !(tool.result as any)?.error;
  const fileName =
    tool.state === "result"
      ? (tool.result as any)?.fileName || ""
      : tool.args?.fileName || "";
  const fileContent = hasContent ? (tool.result as any)?.content || "" : "";
  const webUrl = hasContent ? (tool.result as any)?.webUrl : undefined;
  const contentLength = fileContent.length;

  if (loading) {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text={`Reading ${fileName}...`}
          size="lg"
        />
      </div>
    );
  }

  const formatContentSize = (length: number) => {
    if (length < 1000) return `${length} chars`;
    if (length < 1000000) return `${(length / 1000).toFixed(1)}K chars`;
    return `${(length / 1000000).toFixed(1)}M chars`;
  };

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

  if (tool.state === "result" && (tool.result as any)?.error) {
    return (
      <div className="w-fit rounded-3xl border border-destructive/20 bg-destructive/10 p-2 cursor-default min-h-[34px] h-auto flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
          <svg
            className="w-3.5 h-3.5 text-destructive"
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
        <span className="text-sm text-destructive">
          SharePoint Error: {(tool.result as any).error}
        </span>
      </div>
    );
  }

  if (!webUrl) {
    return (
      <div className="w-fit rounded-3xl border border-border p-2 cursor-default hover:bg-secondary/30 transition-colors duration-200 min-h-[34px] h-auto flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs">
          {getFileIcon(fileName)}
        </div>
        <span className="text-sm text-foreground">{fileName}</span>
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
        <FileIcon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
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
      <div className="text-muted-foreground group-hover:text-primary transition-colors">
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

const LoadFileContentTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResult = tool.state === "result" && tool.result;
  const result = hasResult ? (tool.result as any) : null;
  const fileName = tool.args?.fileName || "";

  if (loading) {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text={`Loading content from ${fileName}...`}
          size="lg"
        />
      </div>
    );
  }

  // Handle error state
  if (hasResult && !result.success) {
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
        <span className="text-sm text-red-700">{result.message}</span>
      </div>
    );
  }

  if (!hasResult || !result.success) {
    return null;
  }

  // Determine if this is a drawing file based on mimeType and tool args
  const isDrawingFile =
    result.mimeType === "application/pdf" &&
    (tool.args?.startPage ||
      tool.args?.endPage ||
      (result.pageInfo && result.pageInfo.toLowerCase().includes("page")));

  // Get display info based on file type
  const getDisplayInfo = () => {
    if (isDrawingFile) {
      // For drawing files, show page information
      if (
        tool.args?.startPage &&
        tool.args?.endPage &&
        tool.args.startPage !== tool.args.endPage
      ) {
        return `Pages ${tool.args.startPage}-${tool.args.endPage}`;
      } else if (tool.args?.startPage) {
        return `Page ${tool.args.startPage}`;
      } else if (result.pageInfo) {
        return result.pageInfo;
      } else {
        return "Page 1";
      }
    } else {
      // For regular documents, show chunk information
      if (
        tool.args?.startChunk &&
        tool.args?.endChunk &&
        tool.args.startChunk !== tool.args.endChunk
      ) {
        return `Chunks ${tool.args.startChunk}-${tool.args.endChunk}`;
      } else if (tool.args?.startChunk) {
        return `Chunk ${tool.args.startChunk}`;
      } else if (
        result.pageInfo &&
        result.pageInfo.toLowerCase().includes("chunk")
      ) {
        return result.pageInfo;
      } else {
        return "First 10 chunks";
      }
    }
  };

  const displayInfo = getDisplayInfo();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden">
            <File className="w-3 h-3 text-muted-foreground" />
          </div>
          <span className="font-normal text-sm">
            {result.fileName || fileName}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">{displayInfo}</span>
        </div>
      </SheetTrigger>
      <SheetContent className="w-full max-w-4xl">
        <SheetHeader>
          <SheetTitle>File Content: {result.fileName || fileName}</SheetTitle>
          <SheetDescription>
            {result.mimeType && `${result.mimeType} • `}
            {displayInfo}
            {result.images &&
              result.images.length > 0 &&
              ` • ${result.images.length} images`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
          {/* Show images if available */}
          {result.images && result.images.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Images
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.images.map((image: any, idx: number) => (
                  <a
                    href={image.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div
                      key={`image-${idx}`}
                      className="border rounded-lg overflow-hidden"
                    >
                      <img
                        src={
                          image.imageUrl ||
                          `data:${image.mimeType || "image/png"};base64,${
                            image.base64Data
                          }`
                        }
                        alt={image.name || `Image ${idx + 1}`}
                        className="w-full h-auto"
                      />
                      {image.name && (
                        <div className="p-2 text-xs text-muted-foreground border-t">
                          {image.name}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Show text content */}
          {result.content && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Content
              </h4>
              <div className="text-sm bg-secondary/30 rounded p-4 max-h-[calc(100vh-400px)] overflow-y-auto font-mono whitespace-pre-wrap">
                {result.content}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SearchFileContentTool = ({ tool }: { tool: ToolInvocation }) => {
  const [open, setOpen] = React.useState(false);
  const loading = tool.state === "partial-call" || tool.state === "call";
  const hasResult = tool.state === "result" && tool.result;
  const result = hasResult ? (tool.result as any) : null;
  const fileName = tool.args?.fileName || "";
  const query = tool.args?.query || "";

  if (loading) {
    return (
      <div className="">
        <Loader
          variant="text-shimmer"
          text={`Searching in ${fileName}...`}
          size="lg"
        />
      </div>
    );
  }

  // Handle error state or no matches
  if (hasResult && (!result.success || result.matches === 0)) {
    return (
      <div className="w-fit rounded-3xl border border-orange-200 bg-orange-50 p-2 cursor-default min-h-[34px] h-auto flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
          <Search className="w-3 h-3 text-orange-500" />
        </div>
        <span className="text-sm text-orange-700">
          No matches found for "{query}" in {fileName}
        </span>
      </div>
    );
  }

  if (!hasResult || !result.success) {
    return null;
  }

  //   const formatContentSize = (length: number) => {
  //     if (length < 1000) return `${length} chars`;
  //     if (length < 1000000) return `${(length / 1000).toFixed(1)}K chars`;
  //     return `${(length / 1000000).toFixed(1)}M chars`;
  //   };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="w-fit rounded-3xl border border-border p-2 cursor-pointer hover:bg-secondary/30 transition-colors duration-200 h-[34px] flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border overflow-hidden">
            <Search className="w-3 h-3 text-muted-foreground" />
          </div>
          <span className="font-normal text-sm">
            {result.matches} {result.matches === 1 ? "match" : "matches"} in{" "}
            {result.fileName || fileName}
          </span>
          {/* {result.content && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {formatContentSize(result.content.length)}
              </span>
            </>
          )}
          {result.images && result.images.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {result.images.length}{" "}
                {result.images.length === 1 ? "image" : "images"}
              </span>
            </>
          )} */}
        </div>
      </SheetTrigger>
      <SheetContent className="w-full max-w-4xl">
        <SheetHeader>
          <SheetTitle>Search Results: {result.fileName || fileName}</SheetTitle>
          <SheetDescription>
            {result.matches} {result.matches === 1 ? "match" : "matches"} for "
            {result.query || query}"
            {result.images &&
              result.images.length > 0 &&
              ` • ${result.images.length} images`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
          {/* Show images if available */}
          {result.images && result.images.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Related Images
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.images.map((image: any, idx: number) => (
                  <div
                    key={`search-image-${idx}`}
                    className="border rounded-lg overflow-hidden"
                  >
                    <img
                      src={
                        image.imageUrl ||
                        `data:${image.mimeType || "image/png"};base64,${
                          image.base64Data
                        }`
                      }
                      alt={image.name || `Image ${idx + 1}`}
                      className="w-full h-auto"
                    />
                    {image.name && (
                      <div className="p-2 text-xs text-muted-foreground border-t">
                        {image.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show search results */}
          {result.content && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">
                Matching Content ({result.matches}{" "}
                {result.matches === 1 ? "result" : "results"})
              </h4>
              <div className="text-sm bg-secondary/30 rounded p-4 max-h-[calc(100vh-400px)] overflow-y-auto font-mono whitespace-pre-wrap">
                {result.content}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const CreateArtifactTool = ({ tool }: { tool: ToolInvocation }) => {
  // This hook handles automatic artifact streaming and selection
  const {
    selectArtifact,
    selectCurrentStreamingArtifact,
    currentStreamingArtifact,
  } = useArtifactManagement(tool);

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
      // Use the current streaming artifact if available (contains latest content)
      // Otherwise fallback to creating one from parsed args
      if (currentStreamingArtifact) {
        selectCurrentStreamingArtifact();
      } else {
        const streamingIdentifier = `streaming-${
          tool.toolCallId || Date.now()
        }`;
        const streamingArtifact: Artifact = {
          identifier: streamingIdentifier,
          type: type || "text/markdown",
          title: title || "Untitled Artifact",
          content: content || "",
          isComplete: false,
        };
        selectArtifact(streamingArtifact);
      }
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
        onClick={() => selectArtifact(artifact)}
      />
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      Failed to create artifact
    </div>
  );
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
    case "load_file_content":
      return <LoadFileContentTool tool={tool} />;
    case "search_file_content":
      return <SearchFileContentTool tool={tool} />;
    case "create_artifact":
      return <CreateArtifactTool tool={tool} />;
    default:
      return null;
  }
};

export default ToolCallMessageContent;
