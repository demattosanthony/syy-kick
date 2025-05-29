/** Hooks */
import { useSearchParams } from "react-router";
import { useCallback, useEffect, useState } from "react";

/** Utils */
import { toast } from "sonner";
import { MicrosoftPicker, PickerOptions } from "@/lib/microsoft-picker";

declare global {
  interface Window {
    OneDrive?: any;
  }
}

export type SortOption =
  | "recent"
  | "name-asc"
  | "name-desc"
  | "created-asc"
  | "created-desc";

export type SharePointFile = {
  name: string;
  webDavUrl?: string;
  webUrl?: string;
  size: number;
  id: string;

  parentReference?: {
    driveId?: string;
    sharepointIds?: {
      listId: string;
      webId: string;
      siteId: string;
      siteUrl: string;
    };
  };

  sharepointIds?: {
    listItemUniqueId?: string;
    listItemId?: string;
    listId?: string;
    webId?: string;
    siteId?: string;
    siteUrl?: string;
  };

  "@sharePoint.embedUrl"?: string;
  "@sharePoint.endpoint"?: string;
  "@sharePoint.listUrl"?: string;
};

export function useMicrosoftPicker({
  onFilesSelected,
}: {
  onFilesSelected: (files: SharePointFile[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
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
      setSearchParams({});
      await microsoftPicker.openPicker(options);
      setLoading(microsoftPicker.getLoadingState());
    },
    [microsoftPicker, setSearchParams]
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
