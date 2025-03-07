"use client";

import React, { useState } from "react";
import {
  File,
  Folder,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, getRelativeTimeString } from "@/lib/utils";
import { DocumentContent } from "@/types/project";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjectDocsQuery, useDeleteProjectContentMutation } from "../api";

interface ProjectFileExplorerProps {
  projectId: string;
  currentPath?: string;
  variant?: "compact" | "detailed";
  initialOpenPathChain?: string[];
  onFileSelect?: (item: DocumentContent) => void;
}

export default function ProjectFileExplorer({
  projectId,
  currentPath,
  variant = "detailed",
  initialOpenPathChain,
  onFileSelect,
}: ProjectFileExplorerProps) {
  const { data: contents, isLoading } = useProjectDocsQuery(
    projectId,
    currentPath
  );

  if (isLoading) {
    return (
      <div className="divide-y w-full max-w-full overflow-x-hidden">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <FileExplorerSkeleton key={item} variant={variant} />
        ))}
      </div>
    );
  }

  if (
    !contents ||
    contents.length === 0 ||
    contents.every((file) => file.name[0] === ".")
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center w-full max-w-full">
        <Folder className="h-12 w-12 mb-4 fill-blue-400 text-blue-400" />
        <h3 className="text-lg font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Upload files or folders to get started with your project
        </p>
      </div>
    );
  }

  const sortedContents = [...contents]
    .filter((file) => !file.name.startsWith("."))
    .sort((a, b) => {
      if (a.name.toLowerCase() === "readme.md") return 1;
      if (b.name.toLowerCase() === "readme.md") return -1;
      return 0;
    });

  return (
    <div className="divide-y w-full max-w-full overflow-x-hidden">
      {sortedContents.map((item) => (
        <FileExplorerItem
          key={item.path}
          item={item}
          projectId={projectId}
          variant={variant}
          initialPathChain={initialOpenPathChain}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
}

interface FileExplorerItemProps {
  item: DocumentContent;
  depth?: number;
  projectId: string;
  variant: "compact" | "detailed";
  initialPathChain?: string[];
  onFileSelect?: (item: DocumentContent) => void;
}

function FileExplorerItem({
  item,
  depth = 0,
  projectId,
  variant,
  initialPathChain = [],
  onFileSelect,
}: FileExplorerItemProps) {
  const router = useRouter();
  const pathname = window.location.pathname;
  const isSelected =
    variant === "compact" && pathname.endsWith(`/${item.path}`);

  const shouldAutoOpen =
    item.type === "folder" &&
    initialPathChain.length > 0 &&
    initialPathChain[0] === item.name;
  const [isOpen, setIsOpen] = useState(shouldAutoOpen);

  const { data: childContents } = useProjectDocsQuery(
    projectId,
    variant === "compact" && item.type === "folder" && isOpen ? item.path : ""
  );

  const deleteProjectContentMutation = useDeleteProjectContentMutation();

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ifc":
        return "🏛️";
      case "pdf":
        return "📑";
      case "xlsx":
      case "xls":
        return "📊";
      case "ttl":
        return "🔄";
      case "dwg":
        return "📏";
      case "rvt":
        return "🏢";
      case "json":
        return "🔧";
      case "html":
        return "🌐";
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
        return "🖼️";
      case "mp4":
      case "mov":
      case "avi":
        return "🎥";
      case "mp3":
      case "wav":
        return "🎵";
      case "zip":
      case "rar":
      case "7z":
        return "📦";
      default:
        return null;
    }
  };

  const handleRowClick = async () => {
    if (variant === "compact" && onFileSelect) {
      if (item.type === "folder") {
        setIsOpen(!isOpen);
      } else onFileSelect(item);
      return;
    }

    if (item.type === "folder") {
      if (variant === "compact") {
        setIsOpen(!isOpen);
      }
      router.push(`/projects/${projectId}/tree/${item.path}`);
    } else {
      // Properly encode the path to handle special characters like #
      const encodedPath = item.path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      router.push(`/projects/${projectId}/blob/${encodedPath}`);
    }
  };

  const toggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div
        className={cn(
          "group flex items-center justify-between p-2 cursor-pointer rounded-lg w-full min-w-0",
          isSelected ? "bg-muted/50" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {item.type === "folder" ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              {variant === "compact" && (
                <div onClick={toggleExpansion}>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
              {variant === "compact" && isOpen ? (
                <FolderOpen className="h-5 w-5 text-blue-400" />
              ) : (
                <Folder className="h-5 w-5 text-blue-400 fill-blue-400" />
              )}
            </div>
          ) : (
            <span
              className={`${
                variant === "compact" ? "ml-[2px]" : ""
              } w-4 flex-shrink-0`}
            >
              {getFileIcon(item.name) || (
                <File className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          )}
          <span className="text-sm hover:underline hover:text-blue-500 truncate min-w-0 max-w-[calc(100vw*0.55)] md:max-w-[calc(100vw*0.30)]">
            {item.name}
          </span>

          {item.processingJob && variant === "detailed" && (
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shadow-md flex-shrink-0 ml-2",
                    {
                      "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20":
                        item.processingJob.status === "failed",
                      "bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/20 animate-pulse":
                        item.processingJob.status === "pending" ||
                        item.processingJob.status === "processing",
                      "bg-gradient-to-br from-green-600 to-green-800 shadow-green-700/20":
                        item.processingJob.status === "completed",
                    }
                  )}
                />
              </TooltipTrigger>
              <TooltipContent>
                {item.processingJob.status === "failed" && "Extraction Failed"}
                {(item.processingJob.status === "pending" ||
                  item.processingJob.status === "processing") &&
                  "Extracting Document Contents"}
                {item.processingJob.status === "completed" &&
                  "Extraction Successful"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {variant === "detailed" && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2 whitespace-nowrap">
            <small className="text-sm font-medium leading-none text-muted-foreground">
              {getRelativeTimeString(item.updatedAt)}
            </small>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:text-accent-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-0">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteProjectContentMutation.mutate({
                      projectId,
                      path: item.path,
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {variant === "compact" &&
        item.type === "folder" &&
        isOpen &&
        childContents && (
          <div className="divide-y w-full max-w-full overflow-x-hidden">
            {childContents.map((child) => (
              <FileExplorerItem
                key={child.path}
                item={child}
                depth={depth + 1}
                projectId={projectId}
                variant={variant}
                onFileSelect={onFileSelect}
                initialPathChain={
                  shouldAutoOpen && initialPathChain.length > 0
                    ? initialPathChain.slice(1)
                    : []
                }
              />
            ))}
          </div>
        )}
    </div>
  );
}

function FileExplorerSkeleton({
  depth = 0,
  variant = "detailed",
}: {
  depth?: number;
  variant?: "compact" | "detailed";
}) {
  return (
    <div
      className="flex items-center justify-between p-2 w-full max-w-full overflow-x-hidden"
      style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Skeleton className="h-5 w-5 flex-shrink-0" />
        <Skeleton className="h-4 w-[220px] " />
      </div>

      {variant === "detailed" && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>
      )}
    </div>
  );
}
