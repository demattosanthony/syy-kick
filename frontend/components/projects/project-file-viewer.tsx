"use client";

import { FileResponse } from "@/types/project";
import MarkdownViewer from "../MarkdownViewer";
import PdfViewer from "../pdf-viewer";

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
    case "text/plain":
    case "application/json":
    case "text/csv":
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
