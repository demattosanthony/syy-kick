"use client";

import { Project } from "@/types/project";
import { ProjectHeader } from "@/features/projects/components";
import { ReactNode } from "react";

interface ProjectLayoutProps {
  project: Project;
  children: ReactNode;
}

export default function ProjectLayout({
  project,
  children,
}: ProjectLayoutProps) {
  return (
    <div className="h-screen w-full flex justify-center pt-14 overflow-x-hidden">
      <div className="flex flex-col items-center max-w-5xl w-full flex-1 min-w-0">
        <ProjectHeader project={project} />

        <div className="flex-1 h-full w-full px-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_265px] gap-4 w-full mt-4 max-w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
