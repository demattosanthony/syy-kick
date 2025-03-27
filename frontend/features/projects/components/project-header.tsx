"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Project } from "@/types/project";
import { ProjectAddFileButton } from "@/features/projects/components";
import { usePermissions } from "@/features/permissions/context";
import { KnowledgeBase } from "@/features/knowledge-bases/types/knowledge-bases";

interface ProjectHeaderProps {
  type: "project" | "knowledge-base";
  project?: Project;
  knowledgeBase?: KnowledgeBase;
}

const ProjectHeader = ({
  project,
  type,
  knowledgeBase,
}: ProjectHeaderProps) => {
  const { canUpdateOrgProjects, canCreateOrgProjectDocs } = usePermissions();

  const name = project?.name ?? knowledgeBase?.name ?? "";
  const logo = project?.organization?.logoUrl ?? project?.user?.profilePicture;

  return (
    <header className="border-b w-full">
      <div className="container pb-4 pt-1 px-6 flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-4 flex-1 items-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={logo} />
              <AvatarFallback>{name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 ">
                <h2 className="text-2xl font-bold">{name}</h2>
                {type === "project" && project?.projectNumber && (
                  <Badge variant={"secondary"}>{project?.projectNumber}</Badge>
                )}
              </div>

              {type === "project" && project?.address && (
                <span className="text-sm text-muted-foreground">
                  {project.address}
                  {project.city ? `, ${project.city}` : ""}
                  {project.state ? `, ${project.state}` : ""}
                  {project.postalCode ? `, ${project.postalCode}` : ""}
                </span>
              )}
            </div>
          </div>

          {type === "project" && project && (
            <div className="flex gap-2">
              {canCreateOrgProjectDocs && (
                <ProjectAddFileButton projectId={project.id} />
              )}

              {canUpdateOrgProjects && (
                <Link
                  href={`/projects/${project.id}/settings`}
                  prefetch={false}
                >
                  <Button variant={"ghost"} size={"icon"}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default ProjectHeader;
