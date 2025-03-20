import { X } from "lucide-react";
import PdfThumbnail from "../pdf-thumbnail";

interface FileUploadSectionProps {
  uploads: Array<{ type: string; preview: string }>;
  removeUpload: (index: number) => void;
}

export function FileUploadSection({
  uploads,
  removeUpload,
}: FileUploadSectionProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="flex gap-3 p-2 flex-wrap h-26 overflow-auto">
      {uploads.map((upload, index) => (
        <div
          key={index}
          className="relative h-24 w-24 rounded-lg overflow-hidden border border-border shadow-sm group"
        >
          {upload.type === "image" ? (
            <img
              src={upload.preview}
              alt={`Upload ${index + 1}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <PdfThumbnail url={upload.preview} width={96} />
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
      ))}
    </div>
  );
}
