"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Project } from "@/types/project";
import { getRelativeTimeString } from "@/lib/utils";
import { FolderClosed, FolderOpen } from "lucide-react";
import { useProjectsQuery } from "../api";

const ProjectsList = () => {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading } = useProjectsQuery({
    search: search,
  });

  return (
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {projects?.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No projects found</p>
        </div>
      ) : (
        projects?.map((project, i) => <ProjectItem key={i} project={project} />)
      )}

      <div ref={scrollRef} className="h-10">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProjectSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ProjectItem({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} prefetch>
      <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full group">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-muted-foreground relative">
            <FolderClosed className="w-6 h-6 absolute text-blue-400 fill-blue-400 transition-opacity duration-200 group-hover:opacity-0" />
            <FolderOpen className="w-6 h-6 text-blue-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xl font-medium">{project.name}</p>

            <p className="text-xs text-muted-foreground ">
              Updated {getRelativeTimeString(project.updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProjectSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export default ProjectsList;