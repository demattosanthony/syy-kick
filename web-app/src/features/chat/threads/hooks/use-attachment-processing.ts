import { useAtom } from "jotai";
import { useCallback } from "react";
import { Attachment } from "@ai-sdk/ui-utils";
import { uploadsAtom, selectedProjectDocsAtom } from "@/atoms/chat";
import api from "@/lib/api";

type ExtendedAttachment = Attachment & {
  file_key: string;
};

export function useAttachmentProcessing() {
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [selectedProjectDocs, setSelectedProjectDocs] = useAtom(
    selectedProjectDocsAtom
  );

  const processAttachments = useCallback(async (): Promise<
    ExtendedAttachment[]
  > => {
    const attachments: ExtendedAttachment[] = [];

    // Process uploads
    if (uploads.length > 0) {
      const uploadAttachments = await Promise.all(
        uploads.map(async (upload) => {
          const { url, file_metadata, viewUrl } =
            await api.uploads.getPresignedUrl(
              upload.file.name,
              upload.file.type,
              upload.file.size,
              `uploads/${Date.now()}-${upload.file.name}`
            );

          // upload directly to storage
          await fetch(url, {
            method: "PUT",
            body: upload.file,
            headers: {
              "Content-Type": upload.file.type,
            },
          });

          const attachment: ExtendedAttachment = {
            name: upload.file.name,
            contentType: upload.file.type,
            url: viewUrl,
            file_key: file_metadata.file_key,
          };

          return attachment;
        })
      );

      attachments.push(...uploadAttachments);
    }

    // Process selected project docs
    if (selectedProjectDocs.length > 0) {
      const docAttachments: ExtendedAttachment[] = selectedProjectDocs
        .filter((doc): doc is typeof doc & { url: string; fileKey: string } =>
          Boolean(doc.url && doc.fileKey)
        )
        .map((doc) => ({
          name: doc.name,
          contentType: doc.mimeType,
          url: doc.url,
          file_key: doc.fileKey,
        }));

      attachments.push(...docAttachments);
    }

    return attachments;
  }, [uploads, selectedProjectDocs]);

  const clearAttachments = useCallback(() => {
    setUploads([]);
    setSelectedProjectDocs([]);
  }, [setUploads, setSelectedProjectDocs]);

  return {
    processAttachments,
    clearAttachments,
    uploads,
    selectedProjectDocs,
  };
}
