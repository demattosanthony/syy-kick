import { Attachment } from "@ai-sdk/ui-utils";
import { Link } from "react-router";
import { File, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import PdfThumbnail from "./pdf-thumbnail";
import msWordLogo from "@/assets/logos/ms-word.svg";
import excelLogo from "@/assets/logos/excel.svg";
import pptxLogo from "@/assets/logos/pptx.svg";
import pdfLogo from "@/assets/logos/pdf.png";

export default function ChatAttachment({
  attachment,
}: {
  attachment: Attachment;
}) {
  const [imageError, setImageError] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  return useMemo(() => {
    const contentType =
      attachment.contentType || (attachment as any).mimeType || "";
    const stableKey = `${attachment.name}-${contentType}`;
    // const isBlob = attachment.url?.startsWith("blob:");

    switch (true) {
      case contentType.startsWith("image"):
        return (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <div
                  key={`img-${stableKey}`}
                  className="cursor-pointer bg-[#242628] dark:bg-input p-2 rounded-lg"
                >
                  {imageError ? (
                    <div className="flex items-center justify-center h-52 max-w-[400px] bg-muted rounded-lg">
                      <div className="text-center text-muted-foreground">
                        <File className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">{attachment.name}</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={attachment.url}
                      alt="user attachment"
                      className="overflow-hidden rounded-lg h-52 max-w-[400px] object-contain"
                      onError={() => setImageError(true)}
                      loading="lazy"
                    />
                  )}
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0 m-0 overflow-hidden text-secondary">
                <DialogTitle className="hidden" />
                <div className="relative w-full h-full overflow-auto">
                  {imageError ? (
                    <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">
                      <div className="text-center">
                        <File className="w-12 h-12 mx-auto mb-4" />
                        <p>Unable to display image</p>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={attachment.url}
                      alt="user attachment"
                      className="w-full object-contain"
                      onError={() => setImageError(true)}
                    />
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        );

      case contentType === "application/pdf":
        return (
          <div
            key={`pdf-${stableKey}`}
            className="bg-[#242628] dark:bg-input p-2 rounded-lg w-[216px]"
          >
            {pdfError ? (
              <div
                className="flex items-center justify-center h-32 w-[200px] bg-muted rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(attachment.url, "_blank")}
              >
                <div className="text-center text-muted-foreground max-w-[195px]">
                  <File className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm truncate">{attachment.name}</p>
                  <p className="text-xs">Click to open</p>
                </div>
              </div>
            ) : (
              <div className="w-[200px] h-32 rounded-lg overflow-hidden">
                <PdfThumbnail
                  url={attachment.url || ""}
                  width={200}
                  onError={() => setPdfError(true)}
                  key={`pdf-thumb-${stableKey}`}
                />
              </div>
            )}
          </div>
        );
      default:
        const getFileExtension = (filename: string) => {
          return filename.split(".").pop()?.toLowerCase() || "";
        };

        const getFileIcon = (extension: string) => {
          switch (extension) {
            case "docx":
            case "doc":
              return msWordLogo;
            case "xlsx":
            case "xls":
              return excelLogo;
            case "pptx":
            case "ppt":
              return pptxLogo;
            case "pdf":
              return pdfLogo;
            default:
              return null;
          }
        };

        const getFileTypeLabel = (extension: string) => {
          switch (extension) {
            case "docx":
            case "doc":
              return "Word Document";
            case "xlsx":
            case "xls":
              return "Excel Spreadsheet";
            case "pptx":
            case "ppt":
              return "PowerPoint";
            case "pdf":
              return "PDF Document";
            case "txt":
              return "Text File";
            case "json":
              return "JSON File";
            case "csv":
              return "CSV File";
            case "zip":
            case "rar":
              return "Archive";
            default:
              return "File";
          }
        };

        const extension = getFileExtension(attachment.name || "");
        const customIcon = getFileIcon(extension);
        const fileTypeLabel = getFileTypeLabel(extension);

        return (
          <div key={`file-${stableKey}`}>
            <Link to={attachment.url || ""} target="_blank">
              <div className="flex items-center bg-[#242628] dark:bg-input text-white rounded-xl p-4 hover:opacity-90 transition-all duration-200 hover:scale-[1.02] border border-border/20 shadow-sm max-w-[320px] group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-muted/20 rounded-lg">
                    {customIcon ? (
                      <img
                        src={customIcon}
                        alt={`${extension} icon`}
                        width={28}
                        height={28}
                        className="object-contain"
                      />
                    ) : (
                      <File className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {attachment.name}
                    </span>
                    <span className="text-xs text-muted dark:text-muted-foreground">
                      {fileTypeLabel}
                    </span>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        );
    }
  }, [
    attachment.name,
    attachment.contentType,
    attachment.url,
    imageError,
    pdfError,
  ]);
}
