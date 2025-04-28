"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ProjectFileExplorer } from "@/features/projects/components";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectContentProps {
  type: "project" | "knowledge-base";
  knowledgeBaseId?: string;
  projectId?: string;
}

export default function ProjectContent({
  projectId,
  type,
  knowledgeBaseId,
}: ProjectContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full min-w-0 shadow-none h-[max-content] max-h-[calc(100vh*0.60)]">
        <CardContent className="p-2 h-full">
          <ScrollArea className="h-full w-full">
            <ProjectFileExplorer
              contentSource={type}
              projectId={type === "project" ? projectId : undefined}
              knowledgeBaseId={
                type === "knowledge-base" ? knowledgeBaseId : undefined
              }
            />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
