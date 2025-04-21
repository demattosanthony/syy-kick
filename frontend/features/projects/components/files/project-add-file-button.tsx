"use client";

import { Plus, FolderClosed, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import React from "react";
import { useUploadDocsMutation } from "../../api";
import { useUploadKnowledgeBaseFiles } from "@/features/knowledge-bases/api";
import Image from "next/image";
import useMicrosoftPicker from "../../hooks/use-microsoft-picker";
import { SharePointFile } from "../../types";

interface UploadButtonsProps {
  projectId?: string;
  knowledgeBaseId?: string;
  contentSource: "project" | "knowledge-base";
}

const ProjectAddFileButton = ({
  projectId,
  knowledgeBaseId,
  contentSource,
}: UploadButtonsProps) => {
  const [open, setOpen] = React.useState(false);

  const {
    openPicker,
    pickerSelectionsToFiles,
    loading: isMicrosoftPickerLoading,
  } = useMicrosoftPicker({
    onFilesSelected: async (files: SharePointFile[]) => {
      const filesToUpload = await pickerSelectionsToFiles(files);

      setOpen(false);
      if (contentSource === "project") {
        await uploadProjectFiles({
          projectId: contentId as string,
          files: filesToUpload,
        });
      }

      if (contentSource === "knowledge-base") {
        await uploadKnowledgeBaseFiles({
          knowledgeBaseId: contentId as string,
          files: filesToUpload,
        });
      }
    },
  });

  const {
    mutateAsync: uploadProjectFiles,
    isPending: isProjectUploading,
    progress: projectUploadProgress,
  } = useUploadDocsMutation();

  const {
    mutateAsync: uploadKnowledgeBaseFiles,
    isPending: isKnowledgeBaseUploading,
    progress: knowledgeBaseUploadProgress,
  } = useUploadKnowledgeBaseFiles();

  const isPending =
    contentSource === "project" ? isProjectUploading : isKnowledgeBaseUploading;
  const progress =
    contentSource === "project"
      ? projectUploadProgress
      : knowledgeBaseUploadProgress;
  const contentId = contentSource === "project" ? projectId : knowledgeBaseId;

  // Ensure one ID is provided based on contentSource
  if (!contentId) {
    console.error(
      `Either projectId or knowledgeBaseId is required when contentSource is "${contentSource}"`
    );
    // Optionally return null or an error indicator component
    return null;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setOpen(false); // Close popover
      const fileArray = Array.from(files);

      // Call the appropriate upload function with the correct parameter structure
      if (contentSource === "project") {
        await uploadProjectFiles({
          projectId: contentId as string,
          files: fileArray,
        });
      } else {
        await uploadKnowledgeBaseFiles({
          knowledgeBaseId: contentId as string,
          files: fileArray,
        });
      }

      console.log("Files uploaded successfully");
    } catch (error: unknown) {
      console.error("Failed to upload files:", error);
    } finally {
      e.target.value = "";
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setOpen(false); // Close popover
      const fileArray = Array.from(files);

      // Call the appropriate upload function with the correct parameter structure
      if (contentSource === "project") {
        await uploadProjectFiles({
          projectId: contentId as string,
          files: fileArray,
        });
      } else {
        await uploadKnowledgeBaseFiles({
          knowledgeBaseId: contentId as string,
          files: fileArray,
        });
      }

      console.log("Folder uploaded successfully");
    } catch (error: unknown) {
      console.error("Failed to upload folder:", error);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="default" className="px-2 gap-1">
            <Plus className="h-3 w-3" />
            Add file
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm"
            >
              <label className="flex items-center gap-2 cursor-pointer w-full">
                <FolderClosed className="h-5 w-5 fill-blue-400 text-blue-400" />
                <input
                  type="file"
                  // @ts-expect-error directory and webkitdirectory are non-standard attributes
                  webkitdirectory=""
                  multiple
                  className="hidden"
                  onChange={handleFolderUpload}
                />
                Upload folder
              </label>
            </Button>
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-sm cursor-pointer"
                asChild
              >
                <span>
                  <File className="h-4 w-4 text-muted-foreground" />
                  Upload files
                </span>
              </Button>
            </label>
          </div>
          <Button
            variant="ghost"
            onClick={() => openPicker({ mode: "files" })}
            className="w-full justify-start gap-2 text-sm cursor-pointer"
            disabled={isMicrosoftPickerLoading || isPending}
          >
            {isMicrosoftPickerLoading || isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Image
                src="/logos/sharepoint.svg"
                alt="Sharepoint"
                width={16}
                height={16}
              />
            )}
            Add from SharePoint
          </Button>
          {/* <Button
            variant="ghost"
            onClick={() => openPicker({ mode: "folder" })}
            className="w-full justify-start gap-2 text-sm cursor-pointer"
            disabled={isMicrosoftPickerLoading}
          >
            {isMicrosoftPickerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image src="/logos/sharepoint.svg" alt="Sharepoint" width={16} height={16} />}
            Upload folder
          </Button> */}
        </PopoverContent>
      </Popover>

      {isPending && (
        <div className="w-48">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Uploading: {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  );
};

export default ProjectAddFileButton;
