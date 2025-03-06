"use client";

import ProjectFileLayout from "@/features/projects/components/files/project-file-layout";
import ProjectFileExplorer from "@/features/projects/components/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams();
  const pathArray = (params.path as string[]) || [];
  const projectId = params.projectId as string;

  const currentPath = pathArray.length ? pathArray.join("/") : "";

  const rightContent = (
    <Card className="max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
      <CardContent className="p-2">
        <ProjectFileExplorer
          projectId={projectId}
          currentPath={currentPath}
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
