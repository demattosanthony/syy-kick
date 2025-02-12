"use client";

import ProjectFileLayout from "@/components/projects/project-file-layout";
import ProjectFileViewer from "@/components/projects/project-file-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectFileQuery } from "@/queries/queries";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const projectId = params.projectId as string;

  const currentPath = pathArray.length ? pathArray.join("/") : "";
  const { data: fileContent } = useProjectFileQuery(projectId, currentPath);

  const rightContent = (
    <Card className="h-full overflow-y-auto">
      <CardContent className="flex flex-col h-full p-0">
        {fileContent && <ProjectFileViewer file={fileContent} />}
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
