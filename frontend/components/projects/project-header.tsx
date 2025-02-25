"use client";

import { useMeQuery, useProjectQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ProjectAddFileButton } from "./project-add-file-button";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import Link from "next/link";

export default function ProjectHeader({ pid }: { pid: string }) {
  const { data: project } = useProjectQuery(pid);
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
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">{project?.name}</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <ProjectAddFileButton projectId={pid} />
            {isOrgOwner && (
              <Link href={`/projects/${pid}/settings`} prefetch={false}>
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
}
