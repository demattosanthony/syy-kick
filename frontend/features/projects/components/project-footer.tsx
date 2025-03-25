"use client";

import { ProjectChatInput } from "@/features/projects/components";

interface ProjectFooterProps {
  projectId: string;
}

export default function ProjectFooter({ projectId }: ProjectFooterProps) {
  return (
    <footer className="absolute bottom-4 inset-x-0 w-full group">
      <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out">
        <div className="w-full max-w-3xl px-4">
          <ProjectChatInput projectId={projectId} />
        </div>
      </div>
    </footer>
  );
}
