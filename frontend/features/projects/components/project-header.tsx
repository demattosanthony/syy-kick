"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Project } from "@/types/project";
import { ProjectAddFileButton } from "@/features/projects/components";
import { useMeQuery } from "@/features/user/api";

const ProjectHeader = ({ project }: { project: Project }) => {
  const { data: me } = useMeQuery();

  // Check if user is an owner of the project's organization or if it's their personal project
  const isOrgOwner = project?.organizationId
    ? me?.organizationMembers?.some(
        (member) =>
          member.organization.id === project.organizationId &&
          member.role === "owner"
      )
    : project?.user?.id === me?.id;

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
            <h2 className="text-2xl font-bold">{project?.name}</h2>
            {project?.projectNumber && (
              <Badge variant={"secondary"} className="">
                {project?.projectNumber}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <ProjectAddFileButton projectId={project.id} />
            {isOrgOwner && (
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
