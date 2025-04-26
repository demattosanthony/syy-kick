"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Folder,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  FolderOpen,
  FileIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
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
import {
  useProjectDocsQuery,
  useDeleteProjectContentMutation,
  useUploadDocsMutation,
} from "../api";
import { usePermissions } from "@/features/permissions/context";
import { Progress } from "@/components/ui/progress";
import {
  useKnowledgeBaseDocuments,
  useUploadKnowledgeBaseFiles,
} from "@/features/knowledge-bases/api";
import { useDeleteKnowledgeBaseContentMutation } from "@/features/knowledge-bases/api/delete-docs";

interface ProjectFileExplorerProps {
  projectId?: string;
  knowledgeBaseId?: string;
  contentSource: "project" | "knowledge-base";
  currentPath?: string;
  variant?: "compact" | "detailed";
  initialOpenPathChain?: string[];
  onFileSelect?: (item: DocumentContent) => void;
}

export default function ProjectFileExplorer({
  projectId,
  knowledgeBaseId,
  contentSource,
  currentPath,
  variant = "detailed",
  initialOpenPathChain,
  onFileSelect,
}: ProjectFileExplorerProps) {
  const contentId = contentSource === "project" ? projectId : knowledgeBaseId;

  // Ensure one ID is provided based on contentSource
  if (!contentId) {
    console.error(
      `${
        contentSource === "project" ? "projectId" : "knowledgeBaseId"
      } is required`
    );
    return null;
  }

  const { data: contents, isLoading } =
    contentSource === "project"
      ? useProjectDocsQuery(contentId, currentPath)
      : useKnowledgeBaseDocuments(contentId, currentPath);

  // -----------------------------
  // DRAG & DROP STATE
  // -----------------------------
  const [isDragging, setIsDragging] = useState(false);
  const explorerRef = useRef<HTMLDivElement>(null);

  // -----------------------------
  // UPLOAD DOCS
  // -----------------------------
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

  // Then use the computed values for UI display
  const isPending =
    contentSource === "project" ? isProjectUploading : isKnowledgeBaseUploading;
  const progress =
    contentSource === "project"
      ? projectUploadProgress
      : knowledgeBaseUploadProgress;

  // -----------------------------
  // PROXIMITY DETECTION
  // (when user drags near explorer)
  // -----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const proximityThreshold = 100;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!explorerRef.current) return;

      const rect = explorerRef.current.getBoundingClientRect();
      const { clientX, clientY } = e;

      // If the mouse is near the explorer, set isDragging
      const isClose =
        clientX >= rect.left - proximityThreshold &&
        clientX <= rect.right + proximityThreshold &&
        clientY >= rect.top - proximityThreshold &&
        clientY <= rect.bottom + proximityThreshold;

      setIsDragging(isClose);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      const rect = document.documentElement.getBoundingClientRect();
      const { clientX, clientY } = e;

      // If truly leaving the viewport
      const isLeaving =
        clientX <= rect.left ||
        clientX >= rect.right ||
        clientY <= rect.top ||
        clientY >= rect.bottom;

      if (isLeaving) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // DRAG & DROP HANDLER
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const entries: FileSystemEntry[] = [];

    // Immediately extract all FileSystemEntry synchronously
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }

    // Recursive function to process entries reliably
    async function processEntry(
      entry: FileSystemEntry,
      path = ""
    ): Promise<File[]> {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        return new Promise<File[]>((resolve, reject) => {
          fileEntry.file(
            (file) => {
              const fileWithPath = new File([file], path + file.name, {
                type: file.type,
                lastModified: file.lastModified,
              });
              Object.defineProperty(fileWithPath, "webkitRelativePath", {
                value: path + file.name,
              });
              resolve([fileWithPath]);
            },
            (error) => reject(error)
          );
        });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirReader = dirEntry.createReader();

        const readAllEntries = (): Promise<FileSystemEntry[]> => {
          return new Promise((resolve, reject) => {
            dirReader.readEntries((entries) => resolve(entries), reject);
          });
        };

        const files: File[] = [];
        let dirEntries: FileSystemEntry[] = [];

        do {
          dirEntries = await readAllEntries();
          for (const childEntry of dirEntries) {
            const childFiles = await processEntry(
              childEntry,
              `${path}${dirEntry.name}/`
            );
            files.push(...childFiles);
          }
        } while (dirEntries.length > 0);

        return files;
      }

      return [];
    }

    const droppedFiles: File[] = [];

    try {
      for (const entry of entries) {
        const filesFromEntry = await processEntry(entry);
        droppedFiles.push(...filesFromEntry);
      }

      if (!droppedFiles.length) return;

      if (contentSource === "project") {
        await uploadProjectFiles({
          projectId: contentId,
          files: droppedFiles,
        });
      } else {
        await uploadKnowledgeBaseFiles({
          knowledgeBaseId: contentId,
          files: droppedFiles,
        });
      }
      console.log("Files/folders uploaded successfully!");
    } catch (error) {
      console.error("Failed to upload files/folders:", error);
    }
  };

  // Traditional React drag over/leave for the actual droppable DOM
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (isLoading) {
    return (
      <div className="divide-y w-full max-w-full overflow-x-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <FileExplorerSkeleton key={i} variant={variant} />
        ))}
      </div>
    );
  }

  // -----------------------------
  // IF EMPTY
  // -----------------------------
  if (
    !contents ||
    contents.length === 0 ||
    contents.every((f) => f.name.startsWith("."))
  ) {
    return (
      <div
        ref={explorerRef}
        className="relative flex flex-col items-center justify-center py-12 px-4 text-center w-full max-w-full bg-background"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div
            className="absolute inset-0 flex items-center justify-center border-2 border-dashed rounded-lg z-10 backdrop-blur-sm"
            style={{
              borderColor: "hsl(var(--drag-drop-border))",
              backgroundColor: "hsl(var(--drag-drop-background) / 0.9)",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span
              className="text-sm flex items-center gap-2"
              style={{ color: "hsl(var(--drag-drop-text))" }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: "hsl(var(--drag-drop-text))" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Drop folders/files to upload
            </span>
          </div>
        )}
        <Folder className="h-12 w-12 mb-4 fill-blue-400 text-blue-400" />
        <h3 className="text-lg font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Drag & drop to upload files/folders (or use the "Add file" button).
        </p>

        {/* Add the upload progress indicator here for empty state */}
        {isPending && (
          <div className="fixed bottom-6 right-6 bg-background/95 border border-border shadow-lg rounded-md p-4 z-50 w-[280px] flex flex-col gap-2 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              Uploading to project files
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {Math.round(progress)}% complete
            </p>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------
  // RENDER FILE EXPLORER
  // (Sort contents, map them)
  // -----------------------------
  const sortedContents = [...contents]
    .filter((f) => !f.name.startsWith("."))
    .sort((a, b) => {
      // Example: push "README.md" down
      if (a.name.toLowerCase() === "readme.md") return 1;
      if (b.name.toLowerCase() === "readme.md") return -1;
      return 0;
    });

  return (
    <div className="relative w-full max-w-full">
      {/* If near drag area, show dashed zone */}
      {isDragging && (
        <div
          className="mb-2 w-full flex items-center justify-center border-2 border-dashed rounded-lg py-2 transition-all duration-200 dark:border-gray-700 dark:bg-gray-800"
          style={{
            borderColor: "hsl(var(--drag-drop-border))",
            backgroundColor: "hsl(var(--drag-drop-background))",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span
            className="text-sm flex items-center gap-2"
            style={{ color: "hsl(var(--drag-drop-text))" }}
          >
            <svg
              className="w-5 h-5"
              style={{ color: "hsl(var(--drag-drop-text))" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Drop folders/files to upload
          </span>
        </div>
      )}
      <div
        ref={explorerRef}
        className={cn(
          "divide-y w-full max-w-full overflow-x-hidden transition-all duration-200",
          isDragging && "border-2 border-border bg-accent/50 rounded-lg"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {sortedContents.map((item) => (
          <FileExplorerItem
            key={item.path}
            item={item}
            contentId={contentId}
            contentSource={contentSource}
            variant={variant}
            initialOpenPathChain={initialOpenPathChain}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>

      {/* Upload progress indicator - fixed position with better styling */}
      {isPending && (
        <div className="fixed bottom-6 right-6 bg-background/95 border border-border shadow-lg rounded-md p-4 z-50 w-[280px] flex flex-col gap-2 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            Uploading to project files
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </div>
      )}
    </div>
  );
}

/* ======================================
   FILE EXPLORER ITEM
   ====================================== */
interface FileExplorerItemProps {
  item: DocumentContent;
  depth?: number;
  contentId: string;
  contentSource: "project" | "knowledge-base";
  variant: "compact" | "detailed";
  initialOpenPathChain?: string[];
  onFileSelect?: (item: DocumentContent) => void;
}

function FileExplorerItem({
  item,
  depth = 0,
  contentId,
  contentSource,
  variant,
  initialOpenPathChain = [],
  onFileSelect,
}: FileExplorerItemProps) {
  const navigate = useNavigate();

  // Figure out if selected in "compact" mode
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const isSelected =
    variant === "compact" && pathname.endsWith(`/${item.path}`);

  // If this folder is in the chain, auto-open it
  const shouldAutoOpen =
    item.type === "folder" &&
    initialOpenPathChain.length > 0 &&
    initialOpenPathChain[0] === item.name;
  const [isOpen, setIsOpen] = useState(shouldAutoOpen);

  // Only query child contents if folder is open (in compact mode)
  const { data: childContents } =
    contentSource === "project"
      ? useProjectDocsQuery(
          contentId,
          variant === "compact" && item.type === "folder" && isOpen
            ? item.path
            : ""
        )
      : useKnowledgeBaseDocuments(
          contentId,
          variant === "compact" && item.type === "folder" && isOpen
            ? item.path
            : ""
        );

  const { canDeleteOrgProjectDocs, canDeleteOrgKnowledgeBaseDocs } =
    usePermissions();

  const deleteProjectContentMutation = useDeleteProjectContentMutation();
  const deleteKnowledgeBaseContentMutation =
    useDeleteKnowledgeBaseContentMutation();

  // Show an emoji for known file extensions
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

  // Handle clicking the row
  const handleRowClick = () => {
    // "compact" mode might not want to navigate, so we allow onFileSelect
    if (variant === "compact" && onFileSelect) {
      if (item.type === "folder") {
        setIsOpen(!isOpen);
      } else {
        onFileSelect(item);
      }
      return;
    }

    // If it's a folder, go to the appropriate tree path
    if (item.type === "folder") {
      if (variant === "compact") {
        setIsOpen(!isOpen);
      }

      const basePath =
        contentSource === "project"
          ? `/projects/${contentId}/tree/`
          : `/knowledge-bases/${contentId}/tree/`;

      navigate(`${basePath}${item.path}`);
    } else {
      // If it's a file, go to the appropriate blob view
      const encodedPath = item.path
        .split("/")
        .map(encodeURIComponent)
        .join("/");

      const basePath =
        contentSource === "project"
          ? `/projects/${contentId}/blob/`
          : `/knowledge-bases/${contentId}/blob/`;

      navigate(`${basePath}${encodedPath}`);
    }
  };

  // Toggle expansion arrow in compact mode
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
        {/* Left side: folder/file icon + name */}
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
            <span className={cn(variant === "compact" && "ml-[2px]", "w-4")}>
              {getFileIcon(item.name) || (
                <FileIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          )}
          <span className="text-sm hover:underline hover:text-blue-500 truncate min-w-0 max-w-[calc(100vw*0.55)] md:max-w-[calc(100vw*0.30)]">
            {item.name}
          </span>

          {/* If there's a known processing job, show a small status dot */}
          {item.processingJob && variant === "detailed" && (
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={cn("h-2 w-2 rounded-full shadow-md ml-2", {
                    "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20":
                      item.processingJob.status === "failed",
                    "bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/20 animate-pulse":
                      item.processingJob.status === "pending" ||
                      item.processingJob.status === "processing",
                    "bg-gradient-to-br from-green-600 to-green-800 shadow-green-700/20":
                      item.processingJob.status === "completed",
                  })}
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

        {/* Right side: updated time + menu (only in detailed mode) */}
        {variant === "detailed" && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2 whitespace-nowrap">
            <small className="text-sm font-medium text-muted-foreground">
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
                  className="w-full justify-start text-destructive hover:bg-destructive/10"
                  disabled={
                    contentSource === "project"
                      ? !canDeleteOrgProjectDocs
                      : !canDeleteOrgKnowledgeBaseDocs
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (contentSource === "project") {
                      deleteProjectContentMutation.mutate({
                        projectId: contentId,
                        path: item.path,
                      });
                    } else {
                      deleteKnowledgeBaseContentMutation.mutate({
                        kbId: contentId,
                        path: item.path,
                      });
                    }
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

      {/* If it's a folder in "compact" mode and open, recursively show its children */}
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
                contentId={contentId}
                contentSource={contentSource}
                variant={variant}
                onFileSelect={onFileSelect}
                initialOpenPathChain={
                  shouldAutoOpen && initialOpenPathChain.length > 0
                    ? initialOpenPathChain.slice(1)
                    : []
                }
              />
            ))}
          </div>
        )}
    </div>
  );
}

/* ======================================
   SKELETON
   ====================================== */
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
        <Skeleton className="h-4 w-[220px]" />
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
