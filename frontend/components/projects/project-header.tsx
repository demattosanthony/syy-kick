"use client";

import { useProjectQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ProjectAddFileButton } from "./project-add-file-button";

export default function ProjectHeader({ pid }: { pid: string }) {
  const { data: project } = useProjectQuery(pid);

  // Use nullish coalescing for a simple fallback
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  return (
    <header className="border-b w-full">
      <div className="container pb-4 pt-1 px-6 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-8 w-8">
              <AvatarImage src={logo} />
              <AvatarFallback>{project?.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">{project?.name}</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <ProjectAddFileButton projectId={pid} />
          </div>
        </div>
      </div>
    </header>
  );
}
