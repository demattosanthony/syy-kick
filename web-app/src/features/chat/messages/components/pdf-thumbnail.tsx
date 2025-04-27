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
    const init = async () => {
      // Initialize worker first
      const pdfjs = await import("pdfjs-dist");

      // Use the dynamically imported module
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      try {
        // Load the PDF using the dynamic import
        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;

        // Get specified page instead of always first page
        const page = await pdf.getPage(pageNumber);

        // Set scale for thumbnail with higher DPI for sharper rendering
        const viewport = page.getViewport({ scale: 1 });
        const scale = (width / viewport.width) * window.devicePixelRatio;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions accounting for device pixel ratio
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // Set display size to desired width while maintaining aspect ratio
        canvas.style.width = `${width}px`;
        canvas.style.height = `${
          (width * scaledViewport.height) / scaledViewport.width
        }px`;

        // Render PDF page to canvas with high quality settings
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          throw new Error("Could not get canvas context");
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (isMounted) setLoading(false);
      } catch (error) {
        console.error("Error generating thumbnail:", error);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [url, width, pageNumber]);

  return (
    <div
      className="thumbnail-container cursor-pointer transition-all rounded overflow-hidden"
      onClick={() => window.open(url, "_blank")}
    >
      {loading && <Skeleton className="h-56" style={{ width: `${width}px` }} />}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </div>
  );
};

export default PdfThumbnail;
