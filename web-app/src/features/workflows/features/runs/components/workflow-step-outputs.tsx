import { FileText, Sheet } from "lucide-react";
import PdfThumbnail from "@/features/chat/messages/components/pdf-thumbnail";
import { WorkflowRunStepOutput } from "../../../workflows.types";
import msWordLogo from "@/assets/logos/ms-word.svg";
import excelLogo from "@/assets/logos/excel.svg";
import pptxLogo from "@/assets/logos/pptx.svg";
import pdfLogo from "@/assets/logos/pdf.png";
import { cn } from "@/lib/utils";

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

          // Construct the appropriate URL
          const downloadUrl = isMarkdown
            ? `/api/files/${id}/download-as-pdf`
            : url;
          // Construct the title, potentially indicating PDF conversion for markdown
          const linkTitle = isMarkdown ? `${name} (Download as PDF)` : name;

          return (
            <div className="flex flex-col gap-1 w-32">
              <a
                key={id}
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-28 h-28 border rounded-lg overflow-hidden group relative hover:shadow-md transition-shadow bg-muted"
                title={linkTitle}
              >
                <div className="h-full flex items-center justify-center p-2">
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
                  ) : isMarkdown ? (
                    <img
                      src={pdfLogo}
                      alt="Markdown as PDF logo"
                      className="w-16 h-16"
                    />
                  ) : isWord ? (
                    <img
                      src={msWordLogo}
                      alt="Word logo"
                      className="w-16 h-16"
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
              </a>
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
