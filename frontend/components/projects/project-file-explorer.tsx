import React, { useState } from "react";
import { ChevronDown, ChevronRight, File, Folder } from "lucide-react";
import { ProjectContent } from "@/types/project";
import { useProjectFilesQuery } from "@/queries/queries";

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
        className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
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
          <span className="text-sm hover:underline">{item.name}</span>
        </div>
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
