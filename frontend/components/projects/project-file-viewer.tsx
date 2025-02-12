"use client";

import { FileResponse } from "@/types/project";
import MarkdownViewer from "../MarkdownViewer";
import PdfViewer from "../pdf-viewer";
import ReactPlayer from "react-player";

export default function ProjectFileViewer({ file }: { file: FileResponse }) {
  // Helper function to get the correct source URL
  const getFileSource = () => {
    if (file.base64Content) {
      return `data:${file.type};base64,${file.base64Content}`;
    }
    return file.s3Url;
  };

  switch (file.type) {
    case "application/pdf":
      return (
        <div className="h-full w-full overflow-hidden">
          <PdfViewer content={file.s3Url || ""} />
        </div>
      );
    case "image/jpeg":
    case "image/png":
    case "image/gif":
    case "image/webp":
    case "image/svg+xml":
      return (
        <div className="h-full w-full flex items-center justify-center">
          <img
            src={getFileSource()}
            alt={file.name}
            style={{ maxWidth: "100%" }}
          />
        </div>
      );
    case "text/markdown":
      return (
        <div className="h-full w-full">
          <MarkdownViewer content={file.content || ""} />
        </div>
      );
    case "text/csv":
      const rows = file.content?.split("\n") || [];
      const headerRow = rows[0];
      const bodyRows = rows.slice(1);

      return (
        <div className="h-full w-full overflow-auto whitespace-nowrap">
          <table className="min-w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gray-100 font-semibold">
                {headerRow?.split(",").map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-2 border overflow-hidden text-ellipsis"
                  >
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t">
                  {row.split(",").map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-4 py-2 border overflow-hidden text-ellipsis"
                    >
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "text/plain":
    case "application/json":
    case "text/javascript":
    case "text/typescript":
    case "text/css":
    case "text/html":
    case "text/yaml":
    case "text/xml":
      return (
        <div className="h-full w-full">
          <pre className="code-viewer">{file.content}</pre>
        </div>
      );
    case "video/mp4":
    case "video/quicktime":
    case "video/x-msvideo":
    case "video/x-flv":
    case "video/x-ms-wmv":
    case "video/webm":
      return (
        <div className="flex flex-1 w-full rounded-lg overflow-hidden flex-col items-center justify-center relative">
          <ReactPlayer
            url={getFileSource()}
            width={"auto"}
            height={"100%"}
            style={{
              zIndex: 10,
              overflow: "hidden",
              position: "relative",
            }}
            controls
          />
        </div>
      );
    default:
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="download-prompt">
            <p>This file type cannot be previewed.</p>
            <a href={file.s3Url} className="download-button">
              Download {file.name}
            </a>
          </div>
        </div>
      );
  }
}
