"use client";

import { useIfcLoader } from "@/hooks/use-ifc-loader";
import { useIfcViewer } from "@/hooks/use-ifc-viewer";
// import IFCViewerToolbar from "./ifc-viewer-toolbar";
import { useEffect, useState } from "react";

export default function IFCViewer({ fileUrl }: { fileUrl?: string }) {
  const { initializeViewer } = useIfcViewer("ifc-viewer");
  const { loadIfcFile, unloadAllIfcFiles } = useIfcLoader();
  const [downloadedFile, setDownloadedFile] = useState<File | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await initializeViewer();
    };

    init();

    return () => cleanup?.();
  }, [initializeViewer]);

  // Download file from URL
  useEffect(() => {
    if (fileUrl) {
      const downloadFile = async () => {
        try {
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to download file: ${response.status} ${response.statusText}`
            );
          }

          const blob = await response.blob();
          const filename = fileUrl.split("/").pop() || "downloaded.ifc";
          const file = new File([blob], filename, {
            type: "application/octet-stream",
          });

          setDownloadedFile(file);
        } catch (error) {
          console.error("Error downloading file:", error);
        }
      };

      downloadFile();
    }
  }, [fileUrl]);

  // Load IFC file
  useEffect(() => {
    if (downloadedFile) {
      unloadAllIfcFiles();
      loadIfcFile(downloadedFile);
    }
  }, [downloadedFile]);

  return (
    <div className="flex flex-1 relative h-full bg-secondary">
      <div id="ifc-viewer" className="absolute top-0 left-0 right-0 bottom-0" />
      {/* <IFCViewerToolbar /> */}
    </div>
  );
}
