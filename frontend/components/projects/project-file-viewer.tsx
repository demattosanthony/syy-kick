"use client";

import { DocumentContent } from "@/types/project";
import ReactPlayer from "react-player";
import { ArrowDown, File } from "lucide-react";
import { useEffect, useState } from "react";
import MultiSheetViewer from "../viewers/excel-viewer";
import PdfViewer from "../viewers/pdf-viewer";
import MarkdownViewer from "../viewers/markdown-viewer";

export default function ProjectFileViewer({ doc }: { doc: DocumentContent }) {
  const [textContent, setTextContent] = useState<string>("");

  useEffect(() => {
    const fetchContent = async () => {
      if (
        doc.url &&
        (doc.mimeType === "text/markdown" ||
          doc.mimeType === "text/csv" ||
          doc.mimeType === "text/plain" ||
          doc.mimeType === "text/html" ||
          doc.mimeType === "application/json" ||
          doc.mimeType === "text/javascript" ||
          doc.mimeType === "text/typescript" ||
          doc.mimeType === "text/css")
      ) {
        try {
          const response = await fetch(doc.url);
          const text = await response.text();
          setTextContent(text);
        } catch (error) {
          console.error("Error fetching file content:", error);
          setTextContent("Error loading file content");
        }
      }
    };

    fetchContent();
  }, [doc.url, doc.mimeType]);

  switch (doc.mimeType) {
    case "application/pdf":
      return (
        <div className="h-full w-full overflow-hidden">
          <PdfViewer content={doc.url || ""} fileName={doc.name} />
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
            src={doc.url}
            alt={doc.name}
            className="max-h-full max-w-[95%] object-contain"
          />
        </div>
      );
    case "text/markdown":
      return (
        <div className="h-full w-full p-8">
          <MarkdownViewer initialContent={textContent || ""} />
        </div>
      );
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return (
        <div className="h-full w-full  overflow-hidden">
          {doc.url && <MultiSheetViewer excelUrl={doc.url} />}
        </div>
      );
    case "text/csv":
      const rows = textContent?.split("\n") || [];
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
        <div className="h-full w-full relative">
          <div className="absolute inset-0 overflow-auto">
            <MarkdownViewer
              initialContent={`\`\`\`${
                doc.mimeType.split("/")[1] || ""
              }\n${textContent}\n\`\`\``}
            />
          </div>
        </div>
      );
    case "video/mp4":
    case "video/quicktime":
    case "video/x-msvideo":
    case "video/x-flv":
    case "video/x-ms-wmv":
    case "video/webm":
      return (
        <div className="flex flex-1 w-full ">
          <ReactPlayer
            url={doc.url}
            width={"auto"}
            height={"100%"}
            style={{
              overflow: "hidden",
              position: "relative",
            }}
            controls
          />
        </div>
      );
    default:
      return (
        <div className="h-full w-full flex items-center justify-center ">
          <div className="text-center max-w-md">
            <div className="mb-4">
              <File className="h-12 w-12 text-gray-400 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Preview Not Available Yet
            </h3>
            <p className="text-gray-600 mb-6">
              This file type cannot be previewed in the browser, but you can
              download it to view it locally.
            </p>
            <a
              href={doc.url}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-priamry bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              download={doc.name}
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              Download {doc.name}
            </a>
          </div>
        </div>
      );
  }
}
