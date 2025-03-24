"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Project } from "@/types/project";
import { getRelativeTimeString } from "@/lib/utils";
import { FolderClosed, FolderOpen } from "lucide-react";
import { useInfiniteProjectsQuery } from "../api";
import { toast } from "sonner";

const ProjectsList = ({
  initialProjects,
}: {
  initialProjects: {
    data: Project[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasMore: boolean;
    };
  };
}) => {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const siteId = searchParams.get("siteId") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use initial projects for first render
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError,
    error } =
    useInfiniteProjectsQuery({
      search: search,
      siteId: siteId,
      limit: 10,
      initialData: {
        pages: [initialProjects],
        pageParams: [1],
      },
    });

  useEffect(() => {
    if (isError && error) {
      toast.error(error.message);
    }
  }, [error, isError]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = scrollRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Use a Set to deduplicate projects by ID
  const uniqueProjects = useMemo(() => {
    const projectsMap = new Map<string, Project>();

    if (data?.pages) {
      data.pages.forEach((page) => {
        page.data.forEach((project) => {
          if (!projectsMap.has(project.id)) {
            projectsMap.set(project.id, project);
          }
        });
      });
    }

    return Array.from(projectsMap.values());
  }, [data?.pages]);

  return (
    <div className="flex flex-col w-full">
      <ScrollArea className="h-[calc(100vh-175px)] px-2">
        {uniqueProjects.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No projects found</p>
          </div>
        ) : (
          <>
            {uniqueProjects.map((project) => (
              <ProjectItem key={project.id} project={project} />
            ))}

            <div ref={scrollRef} className="h-10">
              {(isFetchingNextPage || isLoading) && (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <ProjectSkeleton key={i} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </ScrollArea>
    </div>
  );
};

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

            <p className="text-xs text-muted-foreground">
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
        <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </div>
  );
}

export default ProjectsList;
