import { useAtom } from "jotai";
import { uploadsAtom } from "@/atoms/chat";

export function useAttachmentProcessing() {
  const [uploads, setUploads] = useAtom(uploadsAtom);

  const processAttachments = async () => {
    // Filter only completed uploads with valid file keys
    const completedUploads = uploads.filter(
      (upload) => upload.status === "completed" && upload.fileKey
    );

    // Convert to the format expected by the backend
    const attachments = completedUploads.map((upload) => ({
      file_key: upload.fileKey!,
      name: upload.file.name,
      contentType: upload.file.type,
      url: upload.url,
    }));

    return attachments;
  };

  const clearAttachments = () => {
    // Clean up blob URLs for images
    uploads.forEach((upload) => {
      if (upload.preview && upload.preview.startsWith("blob:")) {
        URL.revokeObjectURL(upload.preview);
      }
    });
    setUploads([]);
  };

  return {
    processAttachments,
    clearAttachments,
  };
}
