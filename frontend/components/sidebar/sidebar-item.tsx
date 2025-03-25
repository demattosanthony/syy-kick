"use client";

import React from "react";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebar } from "../ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { MoreHorizontal } from "lucide-react";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  id: string;
  title: string;
  href: string;
  currentId?: string;
  onDelete?: (id: string) => void;
  itemType: "thread" | "project";
  showOptions?: boolean;
  canDeleteItem?: boolean;
}

export const SidebarItem = ({
  id,
  title,
  href,
  currentId,
  onDelete,
  itemType,
  showOptions = true,
  canDeleteItem = false,
}: SidebarItemProps) => {
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();

  if (!title) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className={cn(
          "group/item flex justify-between items-center hover:bg-accent",
          currentId === id ? "bg-accent text-accent-foreground" : ""
        )}
      >
        <div className="w-full flex justify-between items-center">
          <Link
            href={href}
            prefetch
            onClick={() => isMobile && toggleSidebar()}
            className="text-ellipsis overflow-hidden whitespace-nowrap flex-1"
          >
            {title.length > 28 ? title.slice(0, 28) + "..." : title}
          </Link>

          {showOptions && onDelete && canDeleteItem && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover/item:opacity-100 border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right">
                <DeleteAlertDialog
                  id={id}
                  type={itemType}
                  onDelete={onDelete}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};
