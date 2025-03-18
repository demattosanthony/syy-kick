"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Project } from "@/types/project";
import { ProjectAddFileButton } from "@/features/projects/components";
import { useMeQuery } from "@/features/user/api";
import { usePermissions } from "@/features/permissions/context";

const ProjectHeader = ({ project }: { project: Project }) => {
  const { canUpdateOrgProjects, canCreateOrgProjectDocs } = usePermissions();

  // Use nullish coalescing for a simple fallback
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  return (
    <header className="border-b w-full">
      <div className="container pb-4 pt-1 px-6 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-4 flex-1 items-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={logo} />
              <AvatarFallback>{project?.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 ">
                <h2 className="text-2xl font-bold">{project?.name}</h2>
                {project?.projectNumber && (
                  <Badge variant={"secondary"}>{project?.projectNumber}</Badge>
                )}
              </div>

              {project?.address && (
                <span className="text-sm text-muted-foreground">
                  {project.address}
                  {project.city ? `, ${project.city}` : ""}
                  {project.state ? `, ${project.state}` : ""}
                  {project.postalCode ? `, ${project.postalCode}` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canCreateOrgProjectDocs && (
              <ProjectAddFileButton projectId={project.id} />
            )}
            {canUpdateOrgProjects && (
              <Link href={`/projects/${project.id}/settings`} prefetch={false}>
                <Button variant={"ghost"} size={"icon"}>
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default ProjectHeader;
