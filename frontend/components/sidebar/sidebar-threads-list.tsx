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
import { useThreadsQuery } from "@/queries/queries";
import { User } from "@/types/user";
import Link from "next/link";
import { Button } from "../ui/button";
import { ThreadItem } from "./sidebar-thread-item";

interface ThreadsListProps {
  user: User;
}

export function ThreadsList({ user }: ThreadsListProps) {
  const { data, isLoading } = useThreadsQuery();
  const threads = data?.pages[0]?.threads ?? [];

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
                  thread.title && <ThreadItem key={thread.id} thread={thread} />
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
