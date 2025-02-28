"use client";

import ProjectFileLayout from "@/components/projects/project-file-layout";
import ProjectFileViewer from "@/components/projects/project-file-viewer";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectDocQuery } from "@/queries/queries";
import { useParams, usePathname } from "next/navigation";

export default function Page() {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.projectId as string;

  // Remove the fixed parts of the path to get the file path
  const currentPath = pathname
    .replace(`/projects/${projectId}/blob/`, "")
    .replace(/^\/+|\/+$/g, ""); // Trim any leading/trailing slashes

  const pathArray = currentPath ? currentPath.split("/") : [];

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
      projectId={projectId}
      pathArray={pathArray}
      rightContent={rightContent}
    />
  );
}
