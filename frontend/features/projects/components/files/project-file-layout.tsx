"use client";

import ProjectFileExplorer from "@/features/projects/components/project-file-explorer";
import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface ProjectFileLayoutProps {
  contentSource: "project" | "knowledge-base";
  knowledgeBaseId?: string;
  projectId?: string;
  pathArray: string[];
  rightContent: ReactNode;
}

const ProjectFileLayout = ({
  contentSource,
  knowledgeBaseId,
  projectId,
  pathArray,
  rightContent,
}: ProjectFileLayoutProps) => {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex gap-2 flex-1 pb-2 mx-2 max-h-[calc(100vh-125px)]">
        {/* Left Navigation: full tree with auto-opened folders */}
        <Card className="w-80 h-full flex flex-col overflow-hidden">
          <CardContent className="p-2 px-0 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
            <ProjectFileExplorer
              projectId={contentSource === "project" ? projectId : undefined}
              knowledgeBaseId={
                contentSource === "knowledge-base" ? knowledgeBaseId : undefined
              }
              contentSource={contentSource}
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
};

export default ProjectFileLayout;
