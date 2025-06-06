import { Attachment } from "@ai-sdk/ui-utils";
import { Link } from "react-router";
import { File } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import PdfThumbnail from "./pdf-thumbnail";

export default function ChatAttachment({
  attachment,
}: {
  attachment: Attachment;
}) {
  const [imageError, setImageError] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  return useMemo(() => {
    const contentType = attachment.contentType || "";
    const stableKey = `${attachment.name}-${attachment.url}`;
    const isBlob = attachment.url?.startsWith("blob:");

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
            className="bg-[#242628] dark:bg-input p-2 rounded-lg"
          >
            {pdfError ? (
              <div
                className="flex items-center justify-center h-32 w-[200px] bg-muted rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(attachment.url, "_blank")}
              >
                <div className="text-center text-muted-foreground">
                  <File className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">{attachment.name}</p>
                  <p className="text-xs">Click to open</p>
                </div>
              </div>
            ) : (
              <PdfThumbnail
                url={attachment.url || ""}
                onError={() => setPdfError(true)}
                key={`pdf-thumb-${stableKey}-${isBlob ? "blob" : "url"}`}
              />
            )}
          </div>
        );
      default:
        return (
          <div key={`file-${stableKey}`}>
            <Link to={attachment.url || ""} target="_blank">
              <div className="flex flex-col bg-[#242628] dark:bg-input  text-white rounded-2xl p-3 hover:opacity-90 transition-opacity">
                <div className="flex items-center gap-2 ">
                  <File className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">
                      {attachment.name}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        );
    }
  }, [attachment, imageError, pdfError]); // Include error states in dependencies
}
