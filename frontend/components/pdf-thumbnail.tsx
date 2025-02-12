import { useRef, useEffect, useState } from "react";
import { Skeleton } from "./ui/skeleton";

import * as pdfjsLib from "pdfjs-dist";

export const PdfThumbnail = ({
  url,
  width = 200,
}: {
  url: string;
  width?: number;
}) => {
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      // Initialize worker first
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      try {
        // Load the PDF
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        // Get first page
        const page = await pdf.getPage(1);

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
  }, [url, width]);

  return (
    <div
      className="thumbnail-container cursor-pointer transition-all rounded overflow-hidden"
      onClick={() => window.open(url, "_blank")}
    >
      {loading && <Skeleton className={`h-56 w-[${width}px]`} />}
      <canvas ref={canvasRef} style={{ display: loading ? "none" : "block" }} />
    </div>
  );
};
