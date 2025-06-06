import { Attachment } from "@ai-sdk/ui-utils";
import { Link } from "react-router";
import { File } from "lucide-react";
import { useMemo } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import PdfThumbnail from "./pdf-thumbnail";

export default function ChatAttachment({
  attachment,
}: {
  attachment: Attachment;
}) {
  return useMemo(() => {
    const contentType = attachment.contentType || "";
    const stableKey = `${attachment.name}-${attachment.url}`;

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
                  <img
                    src={attachment.url}
                    alt="user attachment"
                    className="overflow-hidden rounded-lg h-52 max-w-[400px] object-contain"
                  />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0 m-0 overflow-hidden text-secondary">
                <DialogTitle className="hidden" />
                <div className="relative w-full h-full overflow-auto">
                  <img
                    src={attachment.url}
                    alt="user attachment"
                    className="w-full object-contain"
                  />
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
            <PdfThumbnail url={attachment.url || ""} />
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
  }, [attachment]); // Only re-render when attachment changes
}
