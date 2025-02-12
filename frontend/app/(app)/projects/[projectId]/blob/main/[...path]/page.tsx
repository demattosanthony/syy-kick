"use client";

import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import ProjectFileViewer from "@/components/projects/project-file-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectFileQuery, useProjectFilesQuery } from "@/queries/queries";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const projectId = params.projectId as string;

  // LEFT: Fetch the full project file tree (starting at the root)
  const { data: fullProjectContents, isLoading: fullProjectContentsIsLoading } =
    useProjectFilesQuery(projectId);

  // RIGHT: Fetch only the contents of the current folder.
  // If pathArray is empty then we fetch the root contents.
  const currentPath = pathArray.length ? pathArray.join("/") : "";
  const { data: fileContent, isLoading: currentFolderIsLoading } =
    useProjectFileQuery(projectId, currentPath);

  return (
    <div className="h-full w-full flex gap-2 ">
      {/* Left Navigation: full tree with auto-opened folders */}
      <div className="w-80 h-full flex flex-col border-r border-t">
        <ProjectFileExplorer
          contents={fullProjectContents || []}
          projectId={projectId}
          isLoading={fullProjectContentsIsLoading}
          variant="compact"
          initialOpenPathChain={pathArray}
        />
      </div>

      {/* Right Navigation: current folder contents */}
      <Card className="flex-1 h-full">
        <CardContent className="p-2 flex flex-1 h-full">
          {fileContent && <ProjectFileViewer file={fileContent} />}
        </CardContent>
      </Card>
    </div>
  );
}
