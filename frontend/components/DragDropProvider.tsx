"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAtom } from "jotai";
import { modelAtom, uploadsAtom } from "@/atoms/chat";
import { FileUpload } from "@/types/chat";
import { toast } from "sonner";

interface DragAndDropContextType {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
}

const DragAndDropContext = createContext<DragAndDropContextType | undefined>(
  undefined
);

export function DragAndDropProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [, setUploads] = useAtom(uploadsAtom);
  const [model] = useAtom(modelAtom);

  const acceptedTypes = useMemo(() => model.supportedMimeTypes || [], [model]);

  const validateFileSize = useCallback(
    (file: File) => {
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

      // For non-image files (like PDFs)
      const isValidSize = !model.maxFileSize || file.size <= model.maxFileSize;
      if (!isValidSize) {
        toast.error(
          `File size must be under ${
            (model.maxFileSize as number) / (1024 * 1024)
          }MB for the selected model.`
        );
      }
      return isValidSize;
    },
    [model]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!acceptedTypes.length) {
        toast.error("File uploads are not supported for this model.");
        return;
      }

      const files = Array.from(e.dataTransfer?.files || []);
      const validFiles = files.filter((file) => {
        // First check if file type is accepted
        if (!acceptedTypes.includes(file.type)) {
          toast.error(`File type not supported at this time.`);
          return false;
        }

        // Then validate file size
        return validateFileSize(file);
      });

      const newUploads: FileUpload[] = validFiles.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith("image/") ? "image" : "pdf",
      }));

      setUploads((prev) => [...prev, ...newUploads]);
    },
    [model, setUploads, setIsDragging, acceptedTypes, validateFileSize]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const rect = document.documentElement.getBoundingClientRect();
      const isLeaving =
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom;

      if (isLeaving) {
        setIsDragging(false);
      }
    },
    [setIsDragging]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!acceptedTypes.length) return;
      setIsDragging(true);
    },
    [acceptedTypes, setIsDragging]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [model, setUploads]);

  return (
    <DragAndDropContext.Provider value={{ isDragging, setIsDragging }}>
      {children}
      {isDragging && acceptedTypes.length > 0 && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          {/* Animated backdrop */}
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-all duration-300" />

          <div className="absolute inset-4 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-gradient" />
            <div className="absolute inset-[1px] bg-background/95 rounded-xl flex items-center justify-center">
              <p className="text-xl font-light text-primary/70">
                Release to add files
              </p>
            </div>
          </div>
        </div>
      )}
    </DragAndDropContext.Provider>
  );
}

export const useDragAndDrop = () => {
  const context = useContext(DragAndDropContext);
  if (context === undefined) {
    // Instead of throwing an error, return a default value
    return { isDragging: false, setIsDragging: () => {} };
  }
  return context;
};
