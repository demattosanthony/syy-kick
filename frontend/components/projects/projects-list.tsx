"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectsQuery } from "@/queries/queries";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Skeleton } from "../ui/skeleton";
import { Project } from "@/types/project";
import { getRelativeTimeString } from "@/lib/utils";

export default function ProjectsList() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading } = useProjectsQuery({
    search: search,
  });

  console.log(projects);

  return (
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {projects?.map((project, i) => (
        <ProjectItem key={i} project={project} />
      ))}

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
      <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xl font-medium">{project.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-[calc(100vw-8rem)] md:max-w-[calc(100vw-8rem)]">
              {project.description}
            </p>
            <time className="text-xs text-muted-foreground">
              Updated {getRelativeTimeString(project.updatedAt)}
            </time>
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
