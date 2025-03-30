"use client";

import ProjectFileLayout from "@/features/projects/components/files/project-file-layout";
import ProjectFileViewer from "@/features/projects/components/files/project-file-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { useDecodedPathParams } from "@/features/projects/hooks/use-decoded-path-param";
import { useProjectDocQuery } from "@/features/projects/api";

export default function Page() {
  const { projectId, decodedPathArray, currentPath } = useDecodedPathParams();

  const { data: doc } = useProjectDocQuery(projectId, currentPath);

  const rightContent = (
    <Card className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
      <CardContent className="flex flex-col h-full p-0">
        {doc && <ProjectFileViewer doc={doc} />}
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
