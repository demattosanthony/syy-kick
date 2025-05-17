import { Link, useSearchParams } from "react-router";
import { useEffect, useRef, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Project } from "@/types/project";
import { getRelativeTimeString } from "@/lib/utils";
import { FolderClosed, FolderOpen } from "lucide-react";
import { useInfiniteProjectsQuery } from "../api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SortOption } from "../types";

const ProjectsList = () => {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const siteId = searchParams.get("siteId") || "";
  const sort = (searchParams.get("sort") as SortOption) || "created-desc";
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteProjectsQuery({
    search: search,
    siteId: siteId,
    limit: 10,
    sort: sort,
  });

  useEffect(() => {
    if (isError && error) {
      toast.error(error.message || "Failed to load projects");
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {isLoading &&
        uniqueProjects.length === 0 &&
        Array.from({ length: 4 }).map((_, i) => <ProjectSkeleton key={i} />)}

      {!isLoading && uniqueProjects.length === 0 && (
        <div className="col-span-1 md:col-span-2 flex items-center justify-center h-full py-10">
          <p className="text-muted-foreground">No projects found</p>
        </div>
      )}

      {uniqueProjects.map((project) => (
        <ProjectItem key={project.id} project={project} />
      ))}

      <div ref={scrollRef} className="h-1 col-span-1 md:col-span-2"></div>
      {isFetchingNextPage && (
        <>
          <ProjectSkeleton />
          <ProjectSkeleton />
        </>
      )}
    </div>
  );
};

function ProjectItem({ project }: { project: Project }) {
  const relativeTime = getRelativeTimeString(project.updatedAt);

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block p-6 rounded-lg bg-card hover:bg-accent border transition-colors h-full group"
    >
      <div className="flex flex-col gap-4 h-full">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 relative">
          <FolderClosed className="w-8 h-8 absolute text-blue-400 fill-blue-400 transition-opacity duration-200 group-hover:opacity-0" />
          <FolderOpen className="w-8 h-8 text-blue-400 opacity-0 absolute transition-opacity duration-200 group-hover:opacity-100" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-lg font-semibold text-card-foreground line-clamp-2 break-words">
                {project.name}
              </p>
              {project?.projectNumber && (
                <Badge variant={"secondary"} className="flex-shrink-0">
                  {project?.projectNumber}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Updated {relativeTime}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ProjectSkeleton() {
  return (
    <div className="p-6 rounded-lg bg-card border h-full">
      <div className="flex flex-col gap-4">
        <Skeleton className="w-10 h-10 rounded-md bg-muted" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-3/4 bg-muted" />
            <Skeleton className="h-5 w-1/4 bg-muted rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/3 bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default ProjectsList;
