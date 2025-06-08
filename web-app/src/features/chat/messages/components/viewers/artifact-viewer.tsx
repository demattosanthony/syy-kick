// React and hooks
import React from "react";
import { useEffect, useRef, useState } from "react";
import { useSetAtom, useAtom } from "jotai";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Icons and animations
import { motion } from "framer-motion";
import { Check, Copy, Download, X } from "lucide-react";

// State management
import {
  selectedArtifactAtom,
  userClosedArtifactsAtom,
  artifactSelectionModeAtom,
} from "@/atoms/chat";

// Utilities and helpers
import { cn } from "@/lib/utils";

// Types
import { Artifact } from "@/types/chat";

// Content renderers and parsers
import MarkdownViewer from "./markdown-viewer";
import { marked } from "marked";
import { CsvViewer } from "./csv-viewer";
import { CodeViewer } from "./code-viewer";
import { SvgViewer } from "./svg-viewer";

const MermaidViewer: React.FC<{ content: string }> = ({ content }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mermaidRef.current || !diagramRef.current) return;

    const initializeAndRenderMermaid = async () => {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        const id = `mermaid-diagram-${Date.now()}`;
        const currentDiagramRef = diagramRef.current;

        if (!currentDiagramRef) return;
        currentDiagramRef.innerHTML = "<p>Loading diagram...</p>";
        currentDiagramRef.style.cursor = "default";

        const tempRenderDiv = document.createElement("div");
        tempRenderDiv.id = id;
        tempRenderDiv.className = "mermaid";
        tempRenderDiv.textContent = content;
        tempRenderDiv.style.visibility = "hidden";
        tempRenderDiv.style.position = "absolute";
        document.body.appendChild(tempRenderDiv);

        try {
          await mermaid.parse(content);
          const { svg } = await mermaid.render(id, content);

          if (currentDiagramRef) {
            currentDiagramRef.innerHTML = svg;
            currentDiagramRef.style.cursor = "grab";
          }
        } catch (error) {
          console.error("Error parsing or rendering mermaid diagram:", error);
          if (currentDiagramRef) {
            currentDiagramRef.innerHTML =
              '<p class="text-red-500 p-4">Error rendering diagram. Check console for details.</p>';
          }
        } finally {
          if (document.body.contains(tempRenderDiv)) {
            document.body.removeChild(tempRenderDiv);
          }
        }
      } catch (error) {
        console.error("Error loading or initializing mermaid:", error);
        if (diagramRef.current) {
          diagramRef.current.innerHTML =
            '<p class="text-red-500 p-4">Error setting up diagram rendering.</p>';
        }
      }
    };

    initializeAndRenderMermaid();
  }, [content]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const scaleDelta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;

    setScale((prevScale) => {
      const newScale = Math.max(0.1, Math.min(prevScale * scaleDelta, 10));
      return newScale;
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !diagramRef.current) return;
    e.preventDefault();
    const newX = e.clientX - startDragPos.current.x;
    const newY = e.clientY - startDragPos.current.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (diagramRef.current) {
      diagramRef.current.style.cursor = "grab";
    }
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      !diagramRef.current ||
      diagramRef.current.querySelector("svg") === null
    ) {
      return;
    }
    e.preventDefault();
    isDragging.current = true;
    startDragPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    if (diagramRef.current) {
      diagramRef.current.style.cursor = "grabbing";
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={mermaidRef}
      className="w-full flex-1 h-full overflow-hidden cursor-default bg-muted/20"
      onWheel={handleWheel}
    >
      <div
        ref={diagramRef}
        className="w-full h-full flex justify-center items-center"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: "center",
          transition: isDragging.current ? "none" : "transform 0.1s ease-out",
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          if (isDragging.current) e.preventDefault();
        }}
      ></div>
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

const ArtifactViewer: React.FC<{
  artifact: Artifact;
  splitPosition: number;
}> = ({ artifact, splitPosition }) => {
  const [copied, setCopied] = useState(false);
  const setSelectedArtifact = useSetAtom(selectedArtifactAtom);
  const [, setUserClosedArtifacts] = useAtom(userClosedArtifactsAtom);
  const [, setArtifactSelectionMode] = useAtom(artifactSelectionModeAtom);
  const content = artifact.content;
  const title = artifact.title;

  const mimeType = artifact.type || "text/markdown";
  const isStreaming = !artifact.isComplete;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setUserClosedArtifacts((prev) => new Set([...prev, artifact.identifier]));
    setSelectedArtifact(null);
    setArtifactSelectionMode("auto");
  };

  const renderViewer = () => {
    if (mimeType === "application/vnd.ant.mermaid") {
      return <MermaidViewer content={content} />;
    }

    if (mimeType === "image/svg+xml") {
      return <SvgViewer content={content} />;
    }

    if (mimeType === "text/csv") {
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
      <div className="px-12 w-full">
        <MarkdownViewer content={content} />
      </div>
    );
  };

  return (
    <motion.div
      className="h-full flex-1 flex"
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
        className="flex-1 w-full h-full flex flex-col relative shadow-md"
        initial={{ boxShadow: "0 0 0 rgba(0,0,0,0)" }}
        animate={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          transition: { delay: 0.1, duration: 0.3 },
        }}
      >
        {/* Fixed Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-background border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <Button onClick={handleClose} size="icon" variant="ghost">
              <X className="min-w-[18px] min-h-[18px]" />
            </Button>
            <h3 className="text-lg font-medium truncate max-w-[400px]">
              {title}
            </h3>
            {/* {!isStreaming && <Badge variant="secondary">v{version}</Badge>} */}
          </div>
          <div className="flex items-center gap-2">
            {!isStreaming && (
              <DownloadOptions
                title={title}
                content={content}
                mimeType={mimeType}
              />
            )}
            <Button
              onClick={handleCopy}
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
              disabled={!content || content.length === 0}
            >
              {copied ? (
                <Check className="w-[18px] h-[18px] text-green-500" />
              ) : (
                <Copy className="w-[18px] h-[18px]" />
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            "scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          )}
        >
          <div className="p-4 px-6 flex justify-center min-h-full">
            <div className="w-full flex justify-center flex-1 relative">
              {content && content.length > 0 ? (
                renderViewer()
              ) : (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  <div className="text-center">
                    {true ? (
                      <motion.div
                        className="flex flex-col items-center space-y-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        {/* Animated Document Icon */}
                        <motion.div
                          className="relative"
                          animate={{
                            scale: [1, 1.05, 1],
                            rotate: [0, 1, -1, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        >
                          <div className="text-6xl mb-2">📝</div>
                          <motion.div
                            className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full"
                            animate={{
                              scale: [0, 1.2, 0],
                              opacity: [0, 1, 0],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay: 0.2,
                            }}
                          />
                          <motion.div
                            className="absolute -bottom-1 -left-1 w-2 h-2 bg-green-500 rounded-full"
                            animate={{
                              scale: [0, 1, 0],
                              opacity: [0, 0.8, 0],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              delay: 0.8,
                            }}
                          />
                        </motion.div>

                        {/* Animated Text */}
                        <div className="space-y-3">
                          <motion.div
                            className="text-xl font-semibold text-foreground"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            Generating file...
                          </motion.div>

                          {/* Simulated Writing Lines */}
                          <div className="space-y-2 w-80 max-w-full">
                            {[1, 2, 3, 4].map((i) => (
                              <motion.div
                                key={i}
                                className="flex space-x-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.3, 0.6, 0.3, 0] }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  delay: i * 0.5,
                                }}
                              >
                                <div className="h-2 bg-muted rounded-full flex-1" />
                                <div className="h-2 bg-muted rounded-full flex-1" />
                                <div className="h-2 bg-muted rounded-full w-16" />
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Subtle particles effect */}
                        <div className="absolute inset-0 pointer-events-none">
                          {[...Array(6)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute w-1 h-1 bg-primary/30 rounded-full"
                              style={{
                                left: `${20 + i * 12}%`,
                                top: `${30 + (i % 2) * 20}%`,
                              }}
                              animate={{
                                y: [-10, -20, -10],
                                opacity: [0, 0.6, 0],
                                scale: [0.5, 1, 0.5],
                              }}
                              transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                delay: i * 0.4,
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-4">📄</div>
                        <div className="text-lg font-medium mb-2">
                          No content yet
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default React.memo(ArtifactViewer);
