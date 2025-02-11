import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { ProjectContent } from "@/types/project";
import {
  useDeleteProjectContentMutation,
  useProjectFilesQuery,
} from "@/queries/queries";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";

export function ProjectFileExplorer({
  contents,
  projectId,
}: {
  contents: ProjectContent[];
  projectId: string;
}) {
  return (
    <div className="divide-y">
      {contents.map((item) => (
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

  if (item.name === "README.md") return null;

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ifc":
        return "📐";
      case "pdf":
        return "📄";
      case "xlsx":
      case "xls":
        return "📊";
      case "ttl":
        return "🔗";
      case "dwg":
        return "✏️";
      case "rvt":
        return "🏗️";
      case "md":
        return "📝";
      default:
        return null;
    }
  };

  return (
    <div>
      <div
        className="group flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
        style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}
        onClick={() => item.type === "dir" && setIsOpen(!isOpen)}
      >
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
        <Popover>
          <PopoverTrigger asChild>
            <MoreHorizontal className="h-4 w-4 opacity-0 group-hover:opacity-100 hover:text-accent-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-40 p-0">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
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
        <div>
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

export default ProjectFileExplorer;
