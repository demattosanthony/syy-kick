import { Viewer, Worker } from "@react-pdf-viewer/core";
import { useTheme } from "next-themes";
import {
  RenderZoomInProps,
  RenderZoomOutProps,
  zoomPlugin,
} from "@react-pdf-viewer/zoom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDown, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { searchPlugin } from "@react-pdf-viewer/search";
import React from "react";
import useDebounce from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/zoom/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";

const PdfViewer = React.memo(function PdfViewer({
  content,
  fileName,
}: {
  content: string;
  fileName: string;
}) {
  const searchParams = useSearchParams();

  const { resolvedTheme } = useTheme();
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const page = searchParams.get("page");

  // Move plugin instantiation to the top level
  const zoomPluginInstance = zoomPlugin({
    enableShortcuts: true,
  });
  const searchPluginInstance = searchPlugin();

  // Helper function to force a download
  const handleDownload = async (fileUrl: string) => {
    try {
      if (fileUrl.startsWith("data:")) {
        // Base64/data URL
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Otherwise treat as a URL, e.g. from S3
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  // Update the search when the debounced value changes
  React.useEffect(() => {
    if (debouncedSearchQuery) {
      // Only search if there's a query
      searchPluginInstance.highlight(debouncedSearchQuery);
    } else {
      // Clear highlights if query is empty
      searchPluginInstance.clearHighlights();
    }
  }, [debouncedSearchQuery]);

  return (
    <div className="h-full w-full relative">
      {content && (
        <Worker workerUrl="/pdf.worker.min.js">
          <div className="absolute inset-0">
            <div className="flex items-center justify-between px-4 py-2">
              <div />

              {/* Right area: search + download + zoom controls */}
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search..."
                  className="h-8"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <Button
                  onClick={() => handleDownload(content)}
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <FileDown />
                </Button>

                <zoomPluginInstance.ZoomOut>
                  {(props: RenderZoomOutProps) => (
                    <Button
                      onClick={props.onClick}
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <ZoomOutIcon />
                    </Button>
                  )}
                </zoomPluginInstance.ZoomOut>
                <zoomPluginInstance.ZoomIn>
                  {(props: RenderZoomInProps) => (
                    <Button
                      onClick={props.onClick}
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <ZoomInIcon />
                    </Button>
                  )}
                </zoomPluginInstance.ZoomIn>
              </div>
            </div>

            <Viewer
              fileUrl={content}
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              plugins={[zoomPluginInstance, searchPluginInstance]}
              // viewer page is 0-indexed, so subtract 1 from the query param
              initialPage={page ? parseInt(page) - 1 : undefined}
            />
          </div>
        </Worker>
      )}
    </div>
  );
});

export default PdfViewer;
