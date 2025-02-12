// PDF VIEWER

import { Viewer, Worker } from "@react-pdf-viewer/core";

// import { zoomPlugin } from "@react-pdf-viewer/zoom";
// import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
// import useStorageStore from "../../store";
// import { useEffect } from "react";

import "@react-pdf-viewer/core/lib/styles/index.css";
// import "@react-pdf-viewer/zoom/lib/styles/index.css";

// import "@react-pdf-viewer/page-navigation/lib/styles/index.css";

export default function PdfViewer({ content }: { content: string }) {
  //   const zoomPluginInstance = zoomPlugin({ enableShortcuts: true });
  //   const pageNavigationPluginInstance = pageNavigationPlugin();
  //   const setPdfPlugins = useStorageStore((state) => state.setPdfPlugins);

  //   useEffect(() => {
  //     setPdfPlugins(zoomPluginInstance, pageNavigationPluginInstance);

  //     return () => {
  //       setPdfPlugins(null, null);
  //     };
  //   }, []);

  return (
    <div className="h-full w-full relative">
      {content && (
        <Worker workerUrl="/pdf.worker.min.js">
          <div className="absolute inset-0">
            <Viewer fileUrl={content} />
          </div>
        </Worker>
      )}
    </div>
  );
}
