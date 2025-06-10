import { X, File as FileIcon, Loader2 } from "lucide-react";
import PdfThumbnail from "../pdf-thumbnail";
import { FileUpload } from "@/types/chat";
import msWordLogo from "@/assets/logos/ms-word.svg";
import excelLogo from "@/assets/logos/excel.svg";
import pptxLogo from "@/assets/logos/pptx.svg";
import pdfLogo from "@/assets/logos/pdf.png";

interface FileUploadSectionProps {
  uploads: Array<FileUpload>;
  removeUpload: (index: number) => void;
}

export function FileUploadSection({
  uploads,
  removeUpload,
}: FileUploadSectionProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="flex gap-3 p-2 flex-wrap h-28 overflow-hidden">
      {uploads.map((upload, index) => {
        const extension = upload.file.name.split(".").pop()?.toLowerCase();
        let customIconSrc: string | null = null;

        if (extension === "docx" || extension === "doc") {
          customIconSrc = msWordLogo;
        } else if (extension === "xlsx" || extension === "xls") {
          customIconSrc = excelLogo;
        } else if (extension === "pptx" || extension === "ppt") {
          customIconSrc = pptxLogo;
        } else if (extension === "pdf") {
          customIconSrc = pdfLogo;
        }

        const isProcessing = upload.status === "processing";
        const hasError = upload.status === "error";

        return (
          <div
            key={index}
            className="relative h-24 w-24 rounded-lg overflow-hidden border border-border shadow-sm group"
          >
            {upload.type === "image" && (
              <img
                src={upload.preview}
                alt={`Upload ${index + 1}`}
                className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${
                  isProcessing ? "opacity-50" : ""
                }`}
              />
            )}

            {upload.type !== "image" && (
              <div
                className={`h-full w-full flex flex-col items-center justify-center bg-muted/40 p-2 text-center ${
                  isProcessing ? "opacity-50" : ""
                }`}
              >
                {extension === "pdf" && upload.preview ? (
                  <PdfThumbnail url={upload.url || upload.preview} width={96} />
                ) : customIconSrc ? (
                  <>
                    <img
                      src={customIconSrc}
                      alt={`${extension} icon`}
                      width={42}
                      height={42}
                      className="mb-1"
                    />
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {upload.file.name}
                    </span>
                  </>
                ) : (
                  <>
                    <FileIcon className="w-8 h-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {upload.file.name}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {/* Error indicator */}
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm">
                <div className="text-xs text-destructive font-medium">
                  Error
                </div>
              </div>
            )}

            {/* Remove button - only show when not processing */}
            {!isProcessing && (
              <button
                className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                onClick={(e) => {
                  e.preventDefault();
                  removeUpload(index);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Processing status text */}
            {/* {isProcessing && (
              <div className="absolute bottom-1 left-1 right-1 text-xs text-center text-muted-foreground bg-background/80 rounded px-1">
                Processing...
              </div>
            )} */}

            {/* Success indicator */}
            {/* {upload.status === "completed" && (
              <div className="absolute top-1 left-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
            )} */}
          </div>
        );
      })}
    </div>
  );
}
