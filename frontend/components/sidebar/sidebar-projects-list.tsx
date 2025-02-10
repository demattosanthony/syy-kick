"use client";

import * as React from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useDeleteProjectMutation, useProjectsQuery } from "@/queries/queries";
import { User } from "@/types/user";
import Link from "next/link";
import { Button } from "../ui/button";
import { SidebarItem } from "./sidebar-item";

interface ProjectsListProps {
  user: User;
}

export function SidebarProjectsList({ user }: ProjectsListProps) {
  const { data: projects, isLoading } = useProjectsQuery();

  const deleteProjectMutatio = useDeleteProjectMutation();

  const handleDeleteProject = async (id: string) => {
    await deleteProjectMutatio.mutateAsync(id);
  };

  if (projects?.length === 0 || !projects) {
    return null;
  }

  return (
    <SidebarGroup key={"Projects"}>
      <SidebarGroupLabel>{"Projects"}</SidebarGroupLabel>
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
                  //   currentId={currentThreadId as string}
                  onDelete={handleDeleteProject}
                  itemType="project"
                />
              ))}

          {user && (
            <Link href={"/projects"}>
              <Button
                variant={"link"}
                className="justify-start px-2"
                size={"sm"}
              >
                View All
              </Button>
            </Link>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
