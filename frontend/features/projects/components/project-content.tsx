"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ProjectFileExplorer } from "@/features/projects/components";

interface ProjectContentProps {
  projectId: string;
}

export default function ProjectContent({ projectId }: ProjectContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full min-w-0 shadow-none max-h-[min(calc(100vh-300px),700px)] h-min overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent">
        <CardContent className="p-2 w-full max-w-full overflow-x-hidden">
          <ProjectFileExplorer projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
