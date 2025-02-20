import { File, Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import React from "react";

const ToolInvocation = ({ tool, index }: { tool: any; index: number }) => {
  const [showAll, setShowAll] = React.useState(false);

  return (
    <div
      key={index}
      className={cn(
        "flex flex-col gap-2 border-2 p-3 bg-card rounded-xl my-1",
        (tool.state === "partial-call" || tool.state === "call") &&
          "animate-border-pulse"
      )}
    >
      {/* Search Query Section */}
      <div className="flex items-center gap-1">
        <Search className="w-3 h-3 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Searching for:</span>
        <span className="font-medium max-w-[500px] truncate">
          {tool.args?.query}
        </span>
      </div>

      {/* Results Section */}
      {tool.result && (
        <div className="flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">
            Found {tool.result.dataForFrontend.length} relevant sources:
          </div>
          <div className="flex gap-2 flex-wrap max-w-3xl">
            {tool.result.dataForFrontend
              .slice(0, showAll ? undefined : 3)
              .map((result: any, idx: number) => (
                <Badge
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal cursor-pointer w-fit max-w-[200px] hover:bg-secondary/60"
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
              ))}
            {!showAll && tool.result.dataForFrontend.length > 3 && (
              <Badge
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-normal cursor-pointer"
                variant="secondary"
                onClick={() => setShowAll(true)}
              >
                +{tool.result.dataForFrontend.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolInvocation;
