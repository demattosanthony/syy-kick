import { X, File as FileIcon } from "lucide-react";
import PdfThumbnail from "../pdf-thumbnail";
import { FileUpload } from "@/types/chat";

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
    <div className="flex gap-3 p-2 flex-wrap h-26 overflow-auto">
      {uploads.map((upload, index) => {
        const extension = upload.file.name.split(".").pop()?.toLowerCase();
        let customIconSrc: string | null = null;

        if (extension === "docx" || extension === "doc") {
          customIconSrc = "/logos/ms-word.svg";
        } else if (extension === "xlsx" || extension === "xls") {
          customIconSrc = "/logos/excel.svg";
        } else if (extension === "pptx" || extension === "ppt") {
          customIconSrc = "/logos/pptx.svg";
        } else if (extension === "pdf") {
          customIconSrc = "/logos/pdf.png";
        }

        return (
          <div
            key={index}
            className="relative h-24 w-24 rounded-lg overflow-hidden border border-border shadow-sm group"
          >
            {upload.type === "image" && (
              <img
                src={upload.preview}
                alt={`Upload ${index + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            )}

            {upload.type !== "image" && (
              <div className="h-full w-full flex flex-col items-center justify-center bg-muted/40 p-2 text-center">
                {extension === "pdf" ? (
                  <PdfThumbnail url={upload.preview} width={96} />
                ) : customIconSrc ? (
                  <>
                    <Image
                      src={customIconSrc}
                      alt={`${extension} icon`}
                      width={42} // Adjust size as needed
                      height={42} // Adjust size as needed
                      className="mb-1"
                    />
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {upload.file.name}
                    </span>
                  </>
                ) : (
                  // Fallback for other file types
                  <>
                    <FileIcon className="w-8 h-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {upload.file.name}
                    </span>
                  </>
                )}
              </div>
            )}

            <button
              className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              onClick={(e) => {
                e.preventDefault();
                removeUpload(index);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
