import React, { useState } from "react";
import { File, Folder, MoreHorizontal, Trash2 } from "lucide-react";
import { FileResponse, ProjectContent } from "@/types/project";
import {
  useDeleteProjectContentMutation,
  useProjectFilesQuery,
} from "@/queries/queries";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import api from "@/lib/api";
import { getRelativeTimeString } from "@/lib/utils";

export function ProjectFileExplorer({
  contents,
  projectId,
  isLoading,
}: {
  contents: ProjectContent[];
  projectId: string;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="divide-y">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <FileExplorerSkeleton key={item} />
        ))}
      </div>
    );
  }

  if (!contents || contents.length === 0) {
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

  // Sort contents to put README.md last
  const sortedContents = [...contents].sort((a, b) => {
    if (a.name.toLowerCase() === "readme.md") return 1;
    if (b.name.toLowerCase() === "readme.md") return -1;
    return 0;
  });

  return (
    <div className="divide-y">
      {sortedContents.map((item) => (
        <FileExplorerItem key={item.name} item={item} projectId={projectId} />
      ))}
    </div>
  );
}

function FileExplorerItem({
  item,
  depth = 0,
  projectId,
}: {
  item: ProjectContent;
  depth?: number;
  projectId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: childContents } = useProjectFilesQuery(
    projectId,
    item.type === "dir" && isOpen ? item.path : undefined
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

  return (
    <div>
      <div
        className="group flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer rounded"
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={async () => {
          if (item.type === "dir") {
            setIsOpen(!isOpen);
            return;
          }

          // Open file
          const fileRes = await api.projects.getFileContent(
            projectId,
            item.path
          );

          if (fileRes.s3Url) {
            window.open(fileRes.s3Url, "_blank");
          }
          //   setSelectedFile(fileRes);
        }}
      >
        <div className="flex items-center justify-between flex-1">
          <div className="flex items-center gap-2">
            {item.type === "dir" ? (
              <>
                {/* {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )} */}
                <Folder className="h-5 w-5 text-blue-400 fill-blue-400" />
              </>
            ) : (
              <>
                <span className="w-4">
                  {getFileIcon(item.name) || (
                    <File className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              </>
            )}
            <span className="text-sm hover:underline hover:text-blue-500">
              {item.name}
            </span>
          </div>

          <small className="text-sm font-medium leading-none text-muted-foreground ml-4 pr-2">
            {getRelativeTimeString(item.lastModified)}
          </small>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation();
              }}
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
      {isOpen && item.type === "dir" && childContents && (
        <div className="divide-y">
          {childContents.map((child) => (
            <FileExplorerItem
              key={child.path}
              item={child}
              depth={depth + 1}
              projectId={projectId}
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
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-4 w-[100px]" />
    </div>
  );
}

export default ProjectFileExplorer;

export function FileViewer({ file }: { file: FileResponse }) {
  switch (file.type) {
    case "text":
      return <pre className="code-viewer">{file.content}</pre>;

    case "pdf":
      return (
        <iframe
          src={file.s3Url}
          width="100%"
          height="800px"
          frameBorder="0"
          title={file.name}
        ></iframe>
      );

    case "image":
      return (
        <img src={file.s3Url} alt={file.name} style={{ maxWidth: "100%" }} />
      );

    default:
      return (
        <div className="download-prompt">
          <p>This file type cannot be previewed.</p>
          <a href={file.s3Url} className="download-button">
            Download {file.name}
          </a>
        </div>
      );
  }
}
