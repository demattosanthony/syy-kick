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
import { useDeleteThreadMutation, useThreadsQuery } from "@/queries/queries";
import { User } from "@/types/user";
import Link from "next/link";
import { Button } from "../ui/button";
import { SidebarItem } from "./sidebar-item";
import { useParams } from "next/navigation";

interface ThreadsListProps {
  user: User;
}

export function ThreadsList({ user }: ThreadsListProps) {
  const params = useParams();
  const currentThreadId = params?.threadId;
  const { data, isLoading } = useThreadsQuery();
  const threads = data?.pages[0]?.threads ?? [];

  const deleteThreadMutation = useDeleteThreadMutation();

  const handleThreadDelete = async (id: string) => {
    await deleteThreadMutation.mutateAsync(id);
  };

  if (threads.length === 0) {
    return null;
  }

  return (
    <SidebarGroup key={"Recents"}>
      <SidebarGroupLabel>{"Recents"}</SidebarGroupLabel>
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
            : threads.map(
                (thread) =>
                  thread.title && (
                    <SidebarItem
                      key={thread.id}
                      id={thread.id}
                      title={thread.title}
                      href={`/threads/${thread.id}`}
                      currentId={currentThreadId as string}
                      onDelete={handleThreadDelete}
                      itemType="thread"
                    />
                  )
              )}

          {user && (
            <Link href={"/threads"}>
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
