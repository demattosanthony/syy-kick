import { File, Search } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

const ToolInvocation = ({ tool, index }: { tool: any; index: number }) => (
  <div
    key={index}
    className={cn(
      "flex flex-col gap-2 border p-3 bg-card rounded-xl my-1",
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

      {/* Status Indicator */}
      {/* {(tool.state === "partial-call" || tool.state === "call") && (
        <span className="ml-1">
          <span className="inline-block animate-bounce delay-0 text-2xl">
            .
          </span>
          <span className="inline-block animate-bounce delay-100 text-2xl">
            .
          </span>
          <span className="inline-block animate-bounce delay-200 text-2xl">
            .
          </span>
        </span>
      )} */}
    </div>

    {/* Results Section */}
    {tool.result && (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          Found {tool.result.dataForFrontend.length} relevant sources:
        </div>
        <div className="flex gap-2 flex-wrap max-w-3xl">
          {tool.result.dataForFrontend.map((result: any, idx: number) => (
            <Badge
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium cursor-pointer w-fit max-w-[200px] bg-secondary/70"
              variant={"secondary"}
              onClick={() =>
                window.open(
                  result.url + (result.page ? `#page=${result.page}` : ""),
                  "_blank"
                )
              }
              title={`${result.source}${
                result.page ? ` (page ${result.page})` : ""
              }`}
            >
              <File className="w-4 h-4 min-w-[12px]" />
              <div className="flex flex-col w-full truncate">
                <span className="truncate">{result.source}</span>
                {result.page && (
                  <span className="text-xs opacity-75">Page {result.page}</span>
                )}
              </div>
            </Badge>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default ToolInvocation;
