"use client";

import ProjectFileLayout from "@/features/projects/components/files/project-file-layout";
import ProjectFileExplorer from "@/features/projects/components/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { useDecodedPathParams } from "@/features/projects/hooks/use-decoded-path-param";

export default function Page() {
  const { projectId, decodedPathArray, currentPath } = useDecodedPathParams();

  const rightContent = (
    <Card className="max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
      <CardContent className="p-2">
        <ProjectFileExplorer
          projectId={projectId}
          contentSource="project"
          currentPath={currentPath}
          variant="detailed"
        />
      </CardContent>
    </Card>
  );

  return (
    <ProjectFileLayout
      contentSource="project"
      projectId={projectId}
      pathArray={decodedPathArray}
      rightContent={rightContent}
    />
  );
}
