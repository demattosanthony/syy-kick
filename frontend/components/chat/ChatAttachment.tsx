import { Attachment } from "@ai-sdk/ui-utils";
import Link from "next/link";
import { File } from "lucide-react";
import { PdfThumbnail } from "../pdf-thumbnail";
import { useMemo } from "react";

export default function ChatAttachment({
  attachment,
}: {
  attachment: Attachment;
}) {
  return useMemo(() => {
    const contentType = attachment.contentType || "";
    const index = Math.random();

    switch (true) {
      case contentType.startsWith("image"):
        return (
          <div
            key={`img-${attachment.name}-${index}`}
            className="flex justify-end mb-4 cursor-pointer"
            onClick={() => window.open(attachment.url || "", "_blank")}
          >
            <img
              key={index}
              src={attachment.url}
              alt="user attachment"
              className="overflow-hidden rounded-lg h-52 max-w-[400px] object-contain"
            />
          </div>
        );

      case contentType === "application/pdf":
        return (
          <div
            key={`pdf-${attachment.name}-${index}`}
            className="flex justify-end mb-4"
          >
            <PdfThumbnail url={attachment.url || ""} />
          </div>
        );
      default:
        return (
          <div
            key={`file-${attachment.name}-${index}`}
            className="flex justify-end"
          >
            <Link key={index} href={attachment.url || ""} target="_blank">
              <div className="flex items-center gap-1 cursor-pointer hover:opacity-80">
                <File className="w-4 h-4" />
                <span>{attachment.name}</span>
              </div>
            </Link>
          </div>
        );
    }
  }, [attachment]); // Only re-render when attachment changes
}
