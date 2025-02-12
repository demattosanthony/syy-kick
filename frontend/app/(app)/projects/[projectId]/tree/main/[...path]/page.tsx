"use client";

import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import ProjectNavBreadcrumbs from "@/components/projects/project-nav-breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectFilesQuery, useProjectQuery } from "@/queries/queries";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const projectId = params.projectId as string;

  const { data: project } = useProjectQuery(projectId as string);

  // LEFT: Fetch the full project file tree (starting at the root)
  const { data: fullProjectContents, isLoading: fullProjectContentsIsLoading } =
    useProjectFilesQuery(projectId);

  // RIGHT: Fetch only the contents of the current folder.
  // If pathArray is empty then we fetch the root contents.
  const currentPath = pathArray.length ? pathArray.join("/") : "";
  const { data: currentFolderContents, isLoading: currentFolderIsLoading } =
    useProjectFilesQuery(projectId, currentPath);

  return (
    <div className="h-full w-full flex flex-col pt-6">
      <div className="ml-4 mb-2">
        {project && <ProjectNavBreadcrumbs project={project} />}
      </div>

      <div className="flex gap-2 flex-1 pb-2 mx-2 max-h-[calc(100vh-100px)]">
        {/* Left Navigation: full tree with auto-opened folders */}
        <Card className="w-80 h-full flex flex-col ">
          <CardContent className="p-2 px-0 overflow-y-auto">
            <ProjectFileExplorer
              contents={fullProjectContents || []}
              projectId={projectId}
              isLoading={fullProjectContentsIsLoading}
              variant="compact"
              initialOpenPathChain={pathArray}
            />
          </CardContent>
        </Card>

        {/* Right Navigation: current folder contents */}
        <div className="flex-1 h-full overflow-y-auto">
          <Card className=" max-h-full">
            <CardContent className="p-2">
              <ProjectFileExplorer
                contents={currentFolderContents || []}
                projectId={projectId}
                isLoading={currentFolderIsLoading}
                variant="detailed"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
