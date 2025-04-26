"use client";

/** Hooks */
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/** Utils */
import { toast } from "sonner";
import { MicrosoftPicker, PickerOptions } from "../utils/microsoft-picker";

/** Types */
import { SharePointFile } from "../types";

declare global {
  interface Window {
    OneDrive?: any;
  }
}

export function useMicrosoftPicker({
  onFilesSelected,
}: {
  onFilesSelected: (files: SharePointFile[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const searchParams = useSearchParams();
  const oauthSuccess = searchParams.get("oauth_success");
  const [microsoftPicker] = useState(
    () => new MicrosoftPicker(onFilesSelected)
  );

  useEffect(() => {
    if (oauthSuccess === "true") {
      toast.success("Sharepoint connected successfully");
      microsoftPicker.openPicker({ mode: "files" });
    } else if (oauthSuccess === "false") {
      const error = searchParams.get("error");
      toast.error(error || "Sharepoint connection failed");
    }
    setLoading(false);
  }, [oauthSuccess]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      microsoftPicker.handleMessage(event);
    };

    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [microsoftPicker]);

  const openPicker = useCallback(
    async (options: PickerOptions) => {
      setLoading(true);
      await microsoftPicker.openPicker(options);
      setLoading(microsoftPicker.getLoadingState());
    },
    [microsoftPicker]
  );

  const pickerSelectionsToFiles = useCallback(
    async (pickerFiles: SharePointFile[]): Promise<File[]> => {
      setIsProcessingFiles(true);
      try {
        return await microsoftPicker.pickerSelectionsToFiles(pickerFiles);
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [microsoftPicker]
  );

  return {
    openPicker,
    pickerSelectionsToFiles,
    loading,
    isProcessingFiles,
  };
}

export default useMicrosoftPicker;
