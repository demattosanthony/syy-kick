"use client";

import { Plus, FolderClosed, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import React from "react";
import { useUploadDocsMutation } from "../../api";

interface UploadButtonsProps {
  projectId: string;
}

const ProjectAddFileButton = ({ projectId }: UploadButtonsProps) => {
  const [open, setOpen] = React.useState(false);
  const {
    mutateAsync: uploadFiles,
    isPending,
    progress,
  } = useUploadDocsMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setOpen(false); // Close popover after successful upload
      const fileArray = Array.from(files);
      await uploadFiles({ projectId, files: fileArray });
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
      setOpen(false); // Close popover after successful upload
      const fileArray = Array.from(files);
      await uploadFiles({ projectId, files: fileArray });
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
        <PopoverContent className="w-48 p-1">
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
