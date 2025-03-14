"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ProjectFileExplorer } from "@/features/projects/components";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProjectContentProps {
  projectId: string;
}

export default function ProjectContent({ projectId }: ProjectContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full min-w-0 shadow-none h-[max-content] max-h-[calc(100vh*0.65)]">
        <CardContent className="p-2 h-full">
          <ScrollArea className="h-full w-full">
            <ProjectFileExplorer projectId={projectId} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
