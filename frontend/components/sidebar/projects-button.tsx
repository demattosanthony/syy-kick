"use client";

import { FolderClosed, FolderOpen, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CreateProjectDialog } from "@/features/projects/components";
import { usePermissions } from "@/features/permissions/context";

export function ProjectsButton() {
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isProjectsPage = pathname === "/projects";
  const { canCreateOrgProjects } = usePermissions();

  return (
    <div className="relative group/projects">
      <Button
        variant={"ghost"}
        onClick={() => {
          if (isMobile) {
            toggleSidebar();
          }
          router.push("/projects");
        }}
        className={cn(
          "w-full px-2 transition-all",
          state === "collapsed" && !isMobile
            ? "justify-center"
            : "justify-start",
          isProjectsPage && "bg-accent text-accent-foreground"
        )}
      >
        {state === "collapsed" && !isMobile ? (
          <FolderClosed />
        ) : (
          <>
            <FolderClosed className="group-hover/projects:hidden" />
            <FolderOpen className="hidden group-hover/projects:block" />
            Projects
          </>
        )}
      </Button>

      {state === "expanded" && !isMobile && canCreateOrgProjects && (
        <CreateProjectDialog
          trigger={
            <Button
              variant="ghost"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0 opacity-0 group-hover/projects:opacity-100 hover:bg-accent border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
            >
              <Plus className="h-6 w-6" />
            </Button>
          }
        />
      )}
    </div>
  );
}
