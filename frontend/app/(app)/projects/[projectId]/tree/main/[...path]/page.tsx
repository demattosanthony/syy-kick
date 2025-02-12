"use client";

import ProjectFileLayout from "@/components/projects/project-file-layout";
import ProjectFileExplorer from "@/components/projects/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectFilesQuery } from "@/queries/queries";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const projectId = params.projectId as string;

  const currentPath = pathArray.length ? pathArray.join("/") : "";
  const { data: currentFolderContents, isLoading: currentFolderIsLoading } =
    useProjectFilesQuery(projectId, currentPath);

  const rightContent = (
    <Card className="max-h-full">
      <CardContent className="p-2">
        <ProjectFileExplorer
          contents={currentFolderContents || []}
          projectId={projectId}
          isLoading={currentFolderIsLoading}
          variant="detailed"
        />
      </CardContent>
    </Card>
  );

  return (
    <ProjectFileLayout
      projectId={projectId}
      pathArray={pathArray}
      rightContent={rightContent}
    />
  );
}
