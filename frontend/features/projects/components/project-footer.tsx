"use client";

import { ProjectChatInput } from "@/features/projects/components";

interface ProjectFooterProps {
  type: "project" | "knowledge-base";
  knowledgeBaseId?: string;
  projectId?: string;
}

export default function ProjectFooter({
  type,
  projectId,
  knowledgeBaseId,
}: ProjectFooterProps) {
  return (
    <footer className="absolute bottom-4 inset-x-0 w-full group">
      <div className="w-full flex items-center justify-center transition-all duration-300 ease-in-out">
        <div className="w-full max-w-3xl px-4">
          <ProjectChatInput
            projectId={projectId}
            type={type}
            knowledgeBaseId={knowledgeBaseId}
          />
        </div>
      </div>
    </footer>
  );
}
