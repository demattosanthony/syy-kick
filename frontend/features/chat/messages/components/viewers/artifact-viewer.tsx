// React and hooks
import React from "react";
import { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Icons and animations
import { motion } from "framer-motion";
import { Check, Copy, Download, X } from "lucide-react";

// State management
import { selectedArtifactAtom } from "@/atoms/chat";

// Utilities and helpers
import { cn } from "@/lib/utils";
import { getArtifactVersionInfo } from "@/lib/artifact-utils";

// Types
import { Artifact } from "@/types/chat";
import { Message } from "ai";

// Content renderers
import MarkdownViewer from "./markdown-viewer";
import { marked } from "marked";
import mermaid from "mermaid";

export const CsvViewer: React.FC<{ content: string }> = ({ content }) => {
  // Helper function to parse CSV line respecting quotes and handling special cases
  const parseCSVLine = (line: string): string[] => {
    // Special case for architectural dimensions - replace the trailing inch mark temporarily
    line = line.replace(/(\d+)'(\d+)"/g, "$1'$2INCH");

    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // Restore inch symbol before adding to result
        result.push(current.replace(/INCH/g, '"'));
        current = "";
      } else {
        current += char;
      }
    }

    // Restore inch symbol before adding the last item
    result.push(current.replace(/INCH/g, '"'));
    return result;
  };

  const rows = content.split("\n").filter((row) => row.trim() !== "") || [];
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  // Parse header and body using the new parsing function
  const headerCells = headerRow ? parseCSVLine(headerRow) : [];
  const parsedBodyRows = bodyRows.map((row) => parseCSVLine(row));

  // Find the maximum number of columns
  const maxColumns = Math.max(
    headerCells.length,
    ...parsedBodyRows.map((row) => row.length)
  );

  // Pad header cells if needed
  while (headerCells.length < maxColumns) {
    headerCells.push("");
  }
  return (
    <div className="h-full w-full overflow-auto whitespace-nowrap">
      <table className="min-w-full table-fixed border-collapse">
        <thead>
          <tr className="bg-secondary font-semibold">
            {headerCells.map((cell, i) => (
              <td
                key={i}
                className="px-4 py-2 border overflow-hidden text-ellipsis"
              >
                {cell.trim()}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {parsedBodyRows.map((row, i) => {
            // Pad row cells with empty strings if needed
            const cells = [...row];
            while (cells.length < maxColumns) {
              cells.push("");
            }
            return (
              <tr key={i} className="border-t">
                {cells.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2 border overflow-hidden text-ellipsis"
                  >
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const MermaidViewer: React.FC<{ content: string }> = ({ content }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mermaidRef.current) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
      });

      try {
        // Clear previous content
        mermaidRef.current.innerHTML = "";
        const id = `mermaid-diagram-${Date.now()}`;

        // Create a wrapper div to show loading/error states
        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "relative w-full";
        mermaidRef.current.appendChild(wrapperDiv);

        // Create the mermaid container
        const tempDiv = document.createElement("div");
        tempDiv.id = id;
        tempDiv.className = "mermaid";
        tempDiv.textContent = content;
        wrapperDiv.appendChild(tempDiv);

        // Use parse to validate the diagram first
        mermaid
          .parse(content)
          .then(() => {
            // If parsing succeeds, render the diagram
            return mermaid.render(id, content);
          })
          .then(({ svg }) => {
            if (mermaidRef.current) {
              wrapperDiv.innerHTML = svg;
            }
          })
          .catch(() => {
            // console.error("Error rendering mermaid diagram:", error);
          });
      } catch {
        // console.error("Error in mermaid setup:", error);
      }
    }
  }, [content]);

  return (
    <div className="w-full flex justify-center">
      <div
        ref={mermaidRef}
        className="mermaid-container max-w-full overflow-auto"
      />
    </div>
  );
};

const CodeViewer: React.FC<{ content: string; mimeType: string }> = ({
  content,
  mimeType,
}) => {
  // Extract language from MIME type
  let language = "";

  // Check if the MIME type contains a language attribute
  if (mimeType.includes("language=")) {
    // Try to extract the language value
    const match = mimeType.match(/language=["']?([^"'\s;]+)["']?/);
    if (match && match[1]) {
      language = match[1];
    }
  } else {
    // Fall back to MIME type parsing
    language = mimeType.split("/")[1] || "";
    // Clean up any additional parameters
    language = language.split(";")[0].split(" ")[0];
  }

  const wrappedContent = `\`\`\`${language}\n${content}\n\`\`\``;

  return (
    <div className="w-full max-w-full">
      <MarkdownViewer content={wrappedContent} />
    </div>
  );
};

const SvgViewer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="flex justify-center w-full">
      <div
        className="max-w-full"
        style={{ width: "100%", maxHeight: "80vh" }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};

const DownloadOptions: React.FC<{
  title: string;
  content: string;
  mimeType: string;
}> = ({ title, content, mimeType }) => {
  const getFileInfo = () => {
    const types = {
      "text/markdown": { ext: ".md", type: "text/markdown", name: "Markdown" },
      "text/csv": { ext: ".csv", type: "text/csv", name: "Excel" },
      csv: { ext: ".csv", type: "text/csv", name: "Excel" },
      excel: {
        ext: ".xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        name: "Excel",
      },
      spreadsheet: {
        ext: ".xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        name: "Excel",
      },
      "application/json": {
        ext: ".json",
        type: "application/json",
        name: "Text",
      },
      "application/vnd.ant.mermaid": {
        ext: ".mmd",
        type: "text/plain",
        name: "Mermaid",
      },
      "image/svg+xml": { ext: ".svg", type: "image/svg+xml", name: "SVG" },
      default: { ext: ".txt", type: "text/plain", name: "Text" },
    } as const;

    // Check for the special case with language attribute
    if (
      mimeType.includes("application/vnd.ant.code") &&
      mimeType.includes("csv")
    ) {
      return types["csv"];
    }

    const key = (Object.keys(types).find((k) => mimeType.includes(k)) ||
      "default") as keyof typeof types;
    return types[key];
  };

  const handleDownload = () => {
    const { ext, type } = getFileInfo();
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePdfDownload = () => {
    const htmlContent = marked(content);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
              pre { background-color: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
              code { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.9em; background-color: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
              pre code { background-color: transparent; padding: 0; }
              blockquote { border-left: 4px solid #ddd; padding-left: 16px; margin-left: 0; color: #666; }
              img { max-width: 100%; }
              table { border-collapse: collapse; width: 100%; }
              table, th, td { border: 1px solid #ddd; }
              th, td { padding: 8px 12px; }
              th { background-color: #f5f5f5; }
              @media print { body { padding: 0; } pre, code { white-space: pre-wrap; } }
            </style>
          </head>
          <body>
            <div>${htmlContent}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() { window.close(); };
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const { name } = getFileInfo();
  const fileExt = getFileInfo().ext;
  const bgColor =
    fileExt === ".xlsx" || fileExt === ".csv"
      ? "bg-green-700"
      : fileExt === ".md"
      ? "bg-blue-700"
      : "bg-blue-700";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          <Download className="w-[18px] h-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2">
        <div className="flex flex-col gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start font-normal h-auto py-2 px-2.5"
            onClick={handleDownload}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`${bgColor} w-8 h-8 rounded-md flex items-center justify-center`}
              >
                <span className="text-xs font-semibold text-white">
                  {fileExt}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm">{name}</span>
                <span className="text-xs text-muted-foreground">
                  Raw format
                </span>
              </div>
            </div>
          </Button>
          {mimeType === "text/markdown" && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start font-normal h-auto py-2 px-2.5"
              onClick={handlePdfDownload}
            >
              <div className="flex items-center gap-2.5">
                <div className="bg-red-700 w-8 h-8 rounded-md flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">.pdf</span>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm">PDF</span>
                  <span className="text-xs text-muted-foreground">
                    Print-friendly
                  </span>
                </div>
              </div>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Update the main ArtifactViewer component to use these new components
const ArtifactViewer: React.FC<{
  artifact: Artifact;
  splitPosition: number;
  messages: Message[];
}> = ({ artifact, splitPosition, messages }) => {
  const [copied, setCopied] = useState(false);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const { version, content, title } = getArtifactVersionInfo(
    artifact,
    messages
  );
  const mimeType = artifact.type || "text/markdown";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderViewer = () => {
    if (mimeType === "application/vnd.ant.mermaid") {
      return <MermaidViewer content={content} />;
    }

    if (mimeType === "image/svg+xml") {
      return <SvgViewer content={content} />;
    }

    if (
      mimeType.startsWith("application/vnd.ant.code") &&
      mimeType.includes("csv")
    ) {
      return <CsvViewer content={content} />;
    }

    if (
      (mimeType.startsWith("text/") && mimeType !== "text/markdown") ||
      mimeType.startsWith("application/json") ||
      mimeType.startsWith("application/xml") ||
      mimeType.includes("javascript") ||
      mimeType.includes("typescript") ||
      mimeType.includes("python")
    ) {
      return <CodeViewer content={content} mimeType={mimeType} />;
    }

    return (
      <div className="max-w-[750px]">
        <MarkdownViewer content={content} />
      </div>
    );
  };

  return (
    <motion.div
      className="h-full"
      style={{ width: `${100 - splitPosition - 0.25}%`, minWidth: "450px" }}
      initial={{ opacity: 0, x: -50, scale: 0.95 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 },
      }}
      exit={{ opacity: 0, x: -50, scale: 0.95, transition: { duration: 0.2 } }}
    >
      <motion.div
        className="flex-1 w-full h-full relative shadow-md"
        initial={{ boxShadow: "0 0 0 rgba(0,0,0,0)" }}
        animate={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          transition: { delay: 0.1, duration: 0.3 },
        }}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
        >
          <div className="mx-auto">
            <div className="flex justify-between items-center sticky top-0 z-10 px-4 py-3 bg-background/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setSelectedArtifact(null);
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <X className="min-w-[18px] min-h-[18px]" />
                </Button>
                <h3 className="text-lg font-medium truncate max-w-[400px]">
                  {title}
                </h3>
                <Badge variant="secondary">v{version}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <DownloadOptions
                  title={title}
                  content={content}
                  mimeType={mimeType}
                />
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="w-[18px] h-[18px] text-green-500" />
                  ) : (
                    <Copy className="w-[18px] h-[18px]" />
                  )}
                </Button>
              </div>
            </div>
            <div className="p-4 px-6 flex justify-center">
              <div className="w-full flex justify-center">{renderViewer()}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default React.memo(ArtifactViewer);
