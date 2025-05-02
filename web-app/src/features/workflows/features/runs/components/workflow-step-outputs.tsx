import { FileText } from "lucide-react";
import { WorkflowRunStepOutput } from "../../../workflows.types";
import msWordLogo from "@/assets/logos/ms-word.svg";
import excelLogo from "@/assets/logos/excel.svg";
import pptxLogo from "@/assets/logos/pptx.svg";
import pdfLogo from "@/assets/logos/pdf.png";
import { cn } from "@/lib/utils";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDocx from "remark-docx";

interface WorkflowStepOutputsProps {
  outputs: WorkflowRunStepOutput[];
  isLastStep?: boolean;
}

export function WorkflowStepOutputs({
  outputs,
  isLastStep,
}: WorkflowStepOutputsProps) {
  if (!outputs || outputs.length === 0) {
    return null;
  }

  const fileOutputs = outputs.filter(
    (output) => output.file && output.file.url
  );

  if (fileOutputs.length === 0) {
    return null;
  }

  const handleFileClick = async (
    event: React.MouseEvent<HTMLDivElement>,
    url: string,
    fileName: string,
    mimeType: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (mimeType === "text/markdown") {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdownText = await response.text();

        const processor = unified()
          .use(remarkParse)
          .use(remarkDocx as any, { output: "blob" } as any);

        const doc = await processor.process(markdownText);
        const blob = (await doc.result) as Blob;

        const docxFileName =
          fileName.replace(/\.(md|markdown)$/i, ".docx") || "document.docx";

        // Create a download link and trigger it
        const downloadLink = document.createElement("a");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = docxFileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadLink.href);
      } catch (error) {
        console.error("Error processing markdown file:", error);
        alert(
          "Failed to convert Markdown to DOCX. Please check the console for details."
        );
      }
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex flex-wrap gap-4 p-4 rounded-md bg-background/50">
        {fileOutputs.map((output) => {
          const { id, name, mimeType, url } = output.file;

          const isPdf = mimeType?.startsWith("application/pdf");
          const isImage = mimeType?.startsWith("image/");
          const isCsv = mimeType === "text/csv";
          const isWord =
            mimeType ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            mimeType === "application/msword";
          const isPpt =
            mimeType ===
              "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
            mimeType === "application/vnd.ms-powerpoint";
          const isMarkdown = mimeType === "text/markdown";
          const isPlainText = mimeType === "text/plain";

          return (
            <div key={id} className="flex flex-col gap-1 w-32">
              <div
                className="block w-28 h-28 border rounded-lg overflow-hidden group relative hover:shadow-md transition-shadow bg-muted cursor-pointer"
                title={name}
              >
                <div
                  className="h-full flex items-center justify-center p-2"
                  onClick={(e) => handleFileClick(e, url, name, mimeType)}
                >
                  {isPdf ? (
                    <img src={pdfLogo} alt="PDF logo" className="w-16 h-16" />
                  ) : isImage ? (
                    <img
                      src={url}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : isCsv ? (
                    <img
                      src={excelLogo}
                      alt="Excel logo"
                      className="w-16 h-16"
                    />
                  ) : isWord ? (
                    <img
                      src={msWordLogo}
                      alt="Word logo"
                      className="w-16 h-16"
                    />
                  ) : isMarkdown ? (
                    <img
                      src={msWordLogo}
                      alt="Download Markdown as DOCX"
                      title={`Download ${name} as DOCX`}
                      className="w-16 h-16 cursor-pointer"
                    />
                  ) : isPpt ? (
                    <img
                      src={pptxLogo}
                      alt="PowerPoint logo"
                      className="w-16 h-16"
                    />
                  ) : isPlainText ? (
                    <FileText className="w-16 h-16 text-muted-foreground" />
                  ) : (
                    <FileText className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              </div>
              <p
                className={cn(
                  "text-xs text-center w-full",
                  isLastStep ? "line-clamp-2" : "line-clamp-6"
                )}
              >
                {name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
