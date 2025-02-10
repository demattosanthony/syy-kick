"use client";

import React from "react";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "../ui/sidebar";
import { useParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { MoreHorizontal } from "lucide-react";
import { DeleteThreadAlertDialog } from "./delete-thread-alert-dialog";
import { Thread } from "@/types/chat";

interface ThreadItemProps {
  thread: Thread;
}

export const ThreadItem = ({ thread }: ThreadItemProps) => {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const params = useParams();
  const currentThread = params?.threadId;

  if (!thread.title) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={`group/thread flex justify-between items-center ${
          currentThread === thread.id ? "bg-accent text-accent-foreground" : ""
        }`}
      >
        <div className="w-full flex justify-between items-center">
          <Link
            href={`/threads/${thread.id}`}
            onMouseDown={() => isMobile && toggleSidebar()}
            className="text-ellipsis overflow-hidden whitespace-nowrap flex-1"
          >
            {thread.title.length > 28
              ? thread.title.slice(0, 28) + "..."
              : thread.title}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 opacity-0 group-hover/thread:opacity-100 border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right">
              <DeleteThreadAlertDialog threadId={thread.id} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
