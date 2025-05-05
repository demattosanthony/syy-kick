import { useRef, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// import * as pdfjsLib from "pdfjs-dist"; // Remove static import

const PdfThumbnail = ({
  url,
  width = 200,
  pageNumber = 1,
}: {
  url: string;
  width?: number;
  pageNumber?: number;
}) => {
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null; // Use 'any' or import RenderTask type if possible

    const init = async () => {
      setLoading(true); // Reset loading state on each run
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      // Clear previous rendering first
      const context = canvas.getContext("2d");
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      try {
        // Initialize worker first
        const pdfjs = await import("pdfjs-dist");

        // Use the dynamically imported module
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        // Load the PDF using the dynamic import
        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;

        if (!isMounted) return; // Check mount status after await

        // Get specified page instead of always first page
        const page = await pdf.getPage(pageNumber);

        if (!isMounted) return; // Check mount status after await

        // Set scale for thumbnail with higher DPI for sharper rendering
        const viewport = page.getViewport({ scale: 1 });
        const scale = (width / viewport.width) * window.devicePixelRatio;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions accounting for device pixel ratio
        if (!canvasRef.current) {
          // Check ref again just in case
          return;
        }
        canvasRef.current.width = scaledViewport.width;
        canvasRef.current.height = scaledViewport.height;

        // Set display size to desired width while maintaining aspect ratio
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${
          (width * scaledViewport.height) / scaledViewport.width
        }px`;

        // Render PDF page to canvas with high quality settings
        const renderContext = canvasRef.current.getContext("2d", {
          alpha: false,
        });
        if (!renderContext) {
          throw new Error("Could not get canvas context");
        }
        renderContext.imageSmoothingEnabled = true;
        renderContext.imageSmoothingQuality = "high";

        renderTask = page.render({
          canvasContext: renderContext,
          viewport: scaledViewport,
        });

        await renderTask.promise;
        renderTask = null; // Clear task after completion

        if (isMounted) setLoading(false);
      } catch (error: any) {
        renderTask = null; // Clear task on error too
        if (isMounted) {
          // Ignore cancellation errors, log others
          if (error?.name !== "RenderingCancelledException") {
            console.error("Error generating thumbnail:", error);
            // Consider setting an error state here for the UI
          }
          // Keep loading true or set error state if needed on cancellation
          // setLoading(false); // Avoid setting loading false on cancellation or other errors
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      // Cancel the render task if it's still running
      if (renderTask) {
        renderTask.cancel();
        renderTask = null;
      }
    };
  }, [url, width, pageNumber]);

  return (
    <div
      className="thumbnail-container cursor-pointer transition-all rounded overflow-hidden"
      onClick={() => window.open(url, "_blank")}
    >
      {loading && <Skeleton className="w-full h-32" />}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </div>
  );
};

export default PdfThumbnail;
