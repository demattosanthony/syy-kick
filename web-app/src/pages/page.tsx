import api from "@/lib/api";

// Hooks
import { useAtom } from "jotai";
import { useRef, useState } from "react";

// State
import {
  initalInputAtom,
  uploadsAtom,
  modelAtom,
  chatStatusAtom,
} from "@/atoms/chat";
import { pricingPlanDialogOpenAtom } from "@/components/PricingDialog";

// Components
import { toast } from "sonner";
import {
  AnimatedGreeting,
  ChatInputFormRef,
} from "@/features/chat/messages/components";
import ChatInputForm from "@/features/chat/messages/components/chat-input/chat-input";
import { useMeQuery } from "@/features/user/api";
import { useNavigate } from "react-router";
import { SharePointFileBrowser } from "@/features/integrations/microsoft/components/sharepoint-file-browser";
import type { GraphDriveItem } from "@/features/integrations/microsoft/api/microsoft-graph";
import { validateFile } from "@/lib/utils/file-validation";
import { FileUploadMimeType } from "@/types/chat";
import ThreadsList from "@/features/chat/threads/components/threads-list";

// Images
import logo from "@/assets/logo192.png";

// Local type alias if SharePointItem is not exported from its original file
// This mirrors the definition in sharepoint-file-browser.tsx
type SharePointItem = Omit<GraphDriveItem, "folder" | "file"> & {
  folder?: boolean;
  file?: boolean;
  driveId?: string;
  "@microsoft.graph.downloadUrl"?: string; // Ensure this is part of the type for use in handleSharePointFileSelectForWidget
  name: string; // ensure name is part of the type
  id: string; // ensure id is part of the type
};

export function HomePage() {
  const { data: user, isFetched: userFetched } = useMeQuery();

  const navigate = useNavigate();
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const [, setShowPricingDialog] = useAtom(pricingPlanDialogOpenAtom);
  const chatInputRef = useRef<ChatInputFormRef>(null);
  const [uploads, setUploads] = useAtom(uploadsAtom);
  const [selectedModel] = useAtom(modelAtom);
  const [, setChatStatus] = useAtom(chatStatusAtom);
  const [isDownloadingSPFile, setIsDownloadingSPFile] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "" && uploads.length === 0) return;

    // Require login
    if (!user) {
      navigate("/login");
      return;
    }

    setInitalInput(initalInput.trim());
    setChatStatus("submitted");

    try {
      // Create thread in background
      const { id: threadId } = await api.threads.createThread({});
      await api.threads.postMessage({
        threadId,
        message: {
          content: initalInput,
          role: "user",
        },
        model: selectedModel.name,
      });
      navigate(`/threads/${threadId}`);
      setInitalInput("");
    } catch (error: unknown) {
      setChatStatus("error");
      if (error instanceof Error && error.message === "subscription_required") {
        setShowPricingDialog(true);
        toast.error("Pro plan required to create a new thread.");
      } else {
        toast.error("Failed to create thread. Please try again.", {
          action: {
            label: "Retry",
            onClick: () => handleSubmit(),
          },
        });
      }
      // Reset status after showing error
      setTimeout(() => setChatStatus("ready"), 3000);
    }
  };

  // Added handler for SharePoint widget
  const handleSharePointFileSelectForWidget = async (file: SharePointItem) => {
    if (!file["@microsoft.graph.downloadUrl"]) {
      toast.error("No download URL available for this file.");
      return;
    }

    setIsDownloadingSPFile(true);
    try {
      const response = await fetch(file["@microsoft.graph.downloadUrl"]);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      const blob = await response.blob();
      const contentType =
        response.headers.get("Content-Type") || "application/octet-stream";
      const downloadedFile = new window.File([blob], file.name, {
        type: contentType,
      });

      if (
        !validateFile(downloadedFile, selectedModel.supportedMimeTypes || [], {
          maxFileSize: selectedModel.maxFileSize,
          maxImageSize: selectedModel.maxImageSize,
        })
      ) {
        setIsDownloadingSPFile(false);
        return;
      }

      let fileType: FileUploadMimeType = "pdf";
      if (contentType.startsWith("image/")) {
        fileType = "image";
      }

      const fileUpload = {
        file: downloadedFile,
        preview:
          fileType === "image" ? URL.createObjectURL(downloadedFile) : "",
        type: fileType,
      };
      setUploads((prevUploads) => [...prevUploads, fileUpload]);
      toast.success(`Added ${file.name} to your message.`);
    } catch (error) {
      console.error("Error downloading SharePoint file from widget:", error);
      toast.error("Failed to add SharePoint file. Please try again.");
    }

    setIsDownloadingSPFile(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 items-center">
      <div className="flex flex-col items-center w-full gap-4 md:gap-12 max-w-3xl">
        <div className="flex flex-col items-center gap-6">
          <div className="w-[75px] md:w-[75px] flex items-center justify-center min-h-[75px] md:min-h-[75px] mt-[10vh] md:mt-[12vh]">
            <img src={logo} width={75} height={75} alt="Logo" />
          </div>

          <div className="flex flex-col gap-4 md:gap-6">
            {userFetched && (
              <AnimatedGreeting name={user?.name?.split(" ")[0] ?? ""} />
            )}
          </div>
        </div>

        <div className="flex flex-col w-full">
          <ChatInputForm
            input={initalInput}
            setInput={setInitalInput}
            handleInputChange={handleInputChange}
            ref={chatInputRef}
            onSubmit={handleSubmit}
            hasThread={false}
          />
        </div>

        {userFetched && (
          <div className="w-full">
            {user && (
              <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-3xl mx-auto">
                <div className="w-full md:w-1/2 h-min">
                  <SharePointFileBrowser
                    displayMode="inline"
                    onFileSelect={handleSharePointFileSelectForWidget}
                    isDownloading={isDownloadingSPFile}
                  />
                </div>
                <div className="w-full md:w-1/2 h-[400px] border rounded-md bg-card">
                  <div className="flex items-center border-b px-3 h-10">
                    <span className="text-sm font-medium truncate flex-1">
                      Recent Chats
                    </span>
                  </div>
                  <div className="px-1 py-1 overflow-y-auto h-[355px]">
                    <ThreadsList compact={true} showLatestMessage={false} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!user && userFetched && (
        <footer className="text-xs text-gray-500 text-center p-4 shrink-0 w-full">
          By using our service, you agree to our{" "}
          <a
            href="/policies/terms-of-use"
            className="underline hover:text-gray-700"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/policies/privacy-policy"
            className="underline hover:text-gray-700"
          >
            Privacy Policy
          </a>
        </footer>
      )}
    </div>
  );
}
