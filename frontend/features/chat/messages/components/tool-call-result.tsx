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
  const resultCount = hasResults ? tool.result.length : 0;

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
        <div className="flex flex-col gap-6 max-h-[85vh] overflow-y-auto mt-4">
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
                <small className="text-sm font-semibold leading-none">
                  {result.title}
                </small>
                <p className="text-sm line-clamp-3">{result.summary}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-5 h-5 flex-shrink-0">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={result.favicon} alt="" />
                      <AvatarFallback>
                        <Search className="w-3 h-3 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {formatUrl(result.url)}
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
