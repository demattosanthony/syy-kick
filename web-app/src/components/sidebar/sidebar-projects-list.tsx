import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { User } from "@/types/user";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { SidebarItem } from "./sidebar-item";
import { useParams, useLocation, useNavigate } from "react-router";
import { ChevronRight, FolderClosed } from "lucide-react";
import { useProjectsQuery } from "@/features/projects/api";
import { useDeleteProjectMutation } from "@/features/projects/api";
import { usePermissions } from "@/features/permissions/context";

interface ProjectsListProps {
  user: User;
}

export function SidebarProjectsList({ user }: ProjectsListProps) {
  const params = useParams();
  const pathname = useLocation().pathname;
  const navigate = useNavigate();

  // Only set currentThreadId if we're actually on a thread route
  const currentProjectId = pathname.startsWith("/projects/")
    ? typeof params?.projectId === "string"
      ? params.projectId
      : null
    : null;

  const { data: projects, isLoading } = useProjectsQuery({
    limit: 8,
    sort: "recent",
  });
  const deleteProjectMutatio = useDeleteProjectMutation();

  const { canDeleteOrgProjects } = usePermissions();

  const handleDeleteProject = async (id: string) => {
    await deleteProjectMutatio.mutateAsync(id);
    navigate("/");
  };

  if (projects?.length === 0 || !projects) {
    return null;
  }

  return (
    <SidebarGroup key={"Projects"}>
      <SidebarGroupLabel className="gap-1">
        <FolderClosed className="max-h-[12px] max-w-[12px]" />
        {"Projects"}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton asChild>
                    <div className="h-6 w-full bg-muted animate-pulse rounded" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            : projects.map((project) => (
                <SidebarItem
                  key={project.id}
                  id={project.id}
                  title={project.name}
                  href={`/projects/${project.id}`}
                  currentId={currentProjectId as string}
                  onDelete={handleDeleteProject}
                  canDeleteItem={canDeleteOrgProjects}
                  itemType="project"
                />
              ))}

          {user && (
            <Link to={"/projects"}>
              <Button
                variant={"link"}
                className="justify-start px-2 gap-1 text-muted-foreground"
                size={"sm"}
              >
                View All
                <ChevronRight className="max-h-[10px] max-w-[10px]" />
              </Button>
            </Link>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
