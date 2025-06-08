import { useAtom } from "jotai";
import { toast } from "sonner";
import { validateFile } from "@/lib/utils/file-validation";
import { uploadsAtom, modelAtom } from "@/atoms/chat";
import { FileUpload, FileUploadMimeType } from "@/types/chat";
import api from "@/lib/api";

export function useFileUpload(acceptedTypes: string[]) {
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [model] = useAtom(modelAtom);

  const processFileUpload = async (file: File): Promise<void> => {
    // Create initial upload record
    const uploadIndex = uploads.length;

    let fileType: FileUploadMimeType = "other";
    if (file.type.startsWith("image/")) {
      fileType = "image";
    } else if (file.type === "application/pdf") {
      fileType = "pdf";
    }

    const newUpload: FileUpload = {
      file,
      preview:
        fileType === "image" || fileType === "pdf"
          ? URL.createObjectURL(file)
          : "",
      type: fileType,
      status: "uploading",
    };

    // Add to uploads immediately
    setUploads((prev) => [...prev, newUpload]);

    try {
      // Step 1: Get presigned URL
      const { fileKey, uploadUrl, viewUrl } = await api.files.getPresignedUrl(
        file.name,
        file.type,
        file.size
      );

      // Update status to uploading
      setUploads((prev) =>
        prev.map((upload, index) =>
          index === uploadIndex
            ? { ...upload, status: "uploading", fileKey, url: viewUrl }
            : upload
        )
      );

      // Step 2: Upload file to S3
      await api.files.uploadFile(file, uploadUrl);

      // Update status to processing
      setUploads((prev) =>
        prev.map((upload, index) =>
          index === uploadIndex ? { ...upload, status: "processing" } : upload
        )
      );

      // Step 3: Create file record and start processing
      const result = await api.files.createFileRecord(
        file.name,
        file.type,
        file.size,
        fileKey
      );

      // Update status to completed with final data
      setUploads((prev) =>
        prev.map((upload, index) =>
          index === uploadIndex
            ? {
                ...upload,
                status: "completed",
                fileKey: result.fileKey,
                url: result.url,
              }
            : upload
        )
      );

      //   if (result.isExisting) {
      //     toast.info(`File "${file.name}" was already processed.`);
      //   } else {
      //     toast.success(`File "${file.name}" processed successfully.`);
      //   }
    } catch (error) {
      console.error("Error processing file upload:", error);

      // Update status to error
      setUploads((prev) =>
        prev.map((upload, index) =>
          index === uploadIndex
            ? {
                ...upload,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : upload
        )
      );

      toast.error(
        `Failed to process "${file.name}": ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files) {
      processFileList(e.target.files);
    }
  };

  const processFileList = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (
        !validateFile(file, acceptedTypes, {
          maxFileSize: model.maxFileSize,
          maxImageSize: model.maxImageSize,
        })
      ) {
        continue; // validateFile already shows toast messages
      }

      await processFileUpload(file);
    }
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => {
      const upload = prev[index];
      if (upload?.preview && upload.preview.startsWith("blob:")) {
        URL.revokeObjectURL(upload.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await processFileList(files);
  };

  const processFiles = (files: File[]) => {
    processFileList(files);
  };

  // Check if any files are still processing
  const isProcessing = uploads.some(
    (upload) => upload.status === "uploading" || upload.status === "processing"
  );

  // Check if all completed uploads have no errors
  const hasErrors = uploads.some((upload) => upload.status === "error");

  // Check if ready to submit (no processing files and no errors)
  const isReadyToSubmit =
    uploads.length === 0 || (!isProcessing && !hasErrors && uploads.length > 0);

  return {
    handleFiles,
    removeUpload,
    handleDrop,
    processFiles,
    processFileUpload,
    isProcessing,
    hasErrors,
    isReadyToSubmit,
  };
}
