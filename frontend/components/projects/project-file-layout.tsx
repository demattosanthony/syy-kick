"use client";

import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import ProjectNavBreadcrumbs from "@/components/projects/project-nav-breadcrumbs";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectFilesQuery, useProjectQuery } from "@/queries/queries";
import { ReactNode } from "react";

interface ProjectFileLayoutProps {
  projectId: string;
  pathArray: string[];
  rightContent: ReactNode;
}

export default function ProjectFileLayout({
  projectId,
  pathArray,
  rightContent,
}: ProjectFileLayoutProps) {
  const { data: project } = useProjectQuery(projectId);
  const { data: fullProjectContents, isLoading: fullProjectContentsIsLoading } =
    useProjectFilesQuery(projectId);

  return (
    <div className="h-full w-full flex flex-col pt-6">
      <div className="ml-4 mb-2">
        {project && <ProjectNavBreadcrumbs project={project} />}
      </div>

      <div className="flex gap-2 flex-1 pb-2 mx-2 max-h-[calc(100vh-62px)]">
        {/* Left Navigation: full tree with auto-opened folders */}
        <Card className="w-80 h-full flex flex-col">
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

        {/* Right Content */}
        <div className="flex-1 h-full overflow-y-auto">{rightContent}</div>
      </div>
    </div>
  );
}
