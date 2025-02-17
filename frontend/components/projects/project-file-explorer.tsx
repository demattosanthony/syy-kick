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
  useProjectDocsQuery,
  useDeleteProjectContentMutation,
} from "@/queries/queries";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { cn, getRelativeTimeString } from "@/lib/utils";
import { DocumentContent } from "@/types/project";

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
      <div className="divide-y">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <FileExplorerSkeleton key={item} />
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
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Folder className="h-12 w-12 mb-4 fill-blue-400 text-blue-400" />
        <h3 className="text-lg font-semibold mb-2">No files yet</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Upload files or folders to get started with your project
        </p>
      </div>
    );
  }

  // Filter out hidden files and sort contents so that README.md appears last
  const sortedContents = [...contents]
    .filter((file) => !file.name.startsWith("."))
    .sort((a, b) => {
      if (a.name.toLowerCase() === "readme.md") return 1;
      if (b.name.toLowerCase() === "readme.md") return -1;
      return 0;
    });

  return (
    <div className="divide-y">
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

  // If there is a chain and this item’s name matches the first element,
  // then mark it as open by default.
  const shouldAutoOpen =
    item.type === "folder" &&
    initialPathChain.length > 0 &&
    initialPathChain[0] === item.name;
  const [isOpen, setIsOpen] = useState(shouldAutoOpen);

  // In "compact" mode, we load children only when the folder is open.
  const { data: childContents } = useProjectDocsQuery(
    projectId,
    variant === "compact" && item.type === "folder" && isOpen ? item.path : ""
  );

  const deleteProjectContentMutation = useDeleteProjectContentMutation();

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ifc":
        return "🏛️"; // Building/architecture file
      case "pdf":
        return "📑"; // Document
      case "xlsx":
      case "xls":
        return "📊"; // Spreadsheet/charts
      case "ttl":
        return "🔄"; // Turtle/RDF file
      case "dwg":
        return "📏"; // CAD drawing
      case "rvt":
        return "🏢"; // Revit/BIM file
      case "json":
        return "🔧"; // Config/data file
      case "html":
        return "🌐"; // Web page
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
        return "🖼️"; // Images
      case "mp4":
      case "mov":
      case "avi":
        return "🎥"; // Videos
      case "mp3":
      case "wav":
        return "🎵"; // Audio
      case "zip":
      case "rar":
      case "7z":
        return "📦"; // Archives
      default:
        return null;
    }
  };

  // Clicking the row navigates to the detailed view.
  const handleRowClick = async () => {
    // If there was an onFileSelect callback, call it and return.
    if (variant === "compact" && onFileSelect) {
      if (item.type === "folder") {
        setIsOpen(!isOpen);
      } else onFileSelect(item);
      return;
    }

    // Otherwise, navigate to the file or folder.
    if (item.type === "folder") {
      if (variant === "compact") {
        setIsOpen(!isOpen);
      }
      router.push(`/projects/${projectId}/tree/${item.path}`);
    } else {
      router.push(`/projects/${projectId}/blob/${item.path}`);
    }
  };

  // In compact mode, clicking the arrow toggles inline expansion.
  const toggleExpansion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center justify-between p-2 cursor-pointer rounded",
          isSelected ? "bg-muted/50" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-2 max-w-full">
          {item.type === "folder" ? (
            <div className="flex items-center gap-1">
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
                <FolderOpen className="h-5 w-5 text-blue-400 " />
              ) : (
                <Folder className="h-5 w-5 text-blue-400 fill-blue-400" />
              )}
            </div>
          ) : (
            <span className={`${variant === "compact" ? "ml-[20px]" : ""} w-4`}>
              {getFileIcon(item.name) || (
                <File className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          )}
          <span className="text-sm hover:underline hover:text-blue-500 truncate">
            {item.name}
          </span>
        </div>

        {variant === "detailed" && (
          <div className="flex items-center gap-2">
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

      {/* In compact mode, render children inline if this folder is expanded */}
      {variant === "compact" &&
        item.type === "folder" &&
        isOpen &&
        childContents && (
          <div className="divide-y">
            {childContents.map((child) => (
              <FileExplorerItem
                key={child.path}
                item={child}
                depth={depth + 1}
                projectId={projectId}
                variant={variant}
                onFileSelect={onFileSelect}
                // Pass down the remaining chain if this folder was auto-opened.
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

function FileExplorerSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div
      className="flex items-center gap-2 p-2"
      style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
    >
      <Skeleton className="h-6 w-6" />
      <Skeleton className="h-4 w-[165px]" />
    </div>
  );
}
