import { useAtom } from "jotai";
import { modelAtom, uploadsAtom } from "@/atoms/chat";
import { FileUpload } from "@/types/chat";
import { useEffect } from "react";
import { toast } from "sonner";

export function useFileUpload(acceptedTypes: string[]) {
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [model] = useAtom(modelAtom);

  const validateFileSize = (file: File) => {
    if (file.type.startsWith("image/")) {
      const isValidSize =
        !model.maxImageSize || file.size <= model.maxImageSize;
      if (!isValidSize) {
        toast.error(
          `Image file size must be under ${
            (model.maxImageSize as number) / (1024 * 1024)
          }MB for the selected model.`
        );
      }
      return isValidSize;
    }
    const isValidSize = !model.maxFileSize || file.size <= model.maxFileSize;
    if (!isValidSize) {
      toast.error(
        `File size must be under ${
          (model.maxFileSize as number) / (1024 * 1024)
        }MB for the selected model.`
      );
    }
    return isValidSize;
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (!acceptedTypes.includes(file.type)) {
        toast.error(`File type not supported at this time.`);
        return false;
      }
      return validateFileSize(file);
    });

    const newUploads: FileUpload[] = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith("image/") ? "image" : "pdf",
    }));

    setUploads((prev) => [...prev, ...newUploads]);
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => {
      const updatedUploads = [...prev];
      URL.revokeObjectURL(updatedUploads[index].preview);
      updatedUploads.splice(index, 1);
      return updatedUploads;
    });
  };

  const clearUploads = () => {
    uploads.forEach((upload) => URL.revokeObjectURL(upload.preview));
    setUploads([]);
  };

  useEffect(() => {
    return () => {
      uploads.forEach((upload) => URL.revokeObjectURL(upload.preview));
    };
  }, [uploads]);

  return {
    uploads,
    handleFiles,
    removeUpload,
    clearUploads,
    handleDrop,
    processFiles,
  };
}
