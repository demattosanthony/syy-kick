"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { useIsMobile } from "@/hooks/use-mobile";
import { User } from "@/types/user";
import { WorkSpaceSwitcher } from "./workspace-switcher";
import { ThreadsList } from "./sidebar-threads-list";
import { ThreadsLink } from "./threads-link";
import { SidebarButton } from "./sidebar-button";
import { DropdownMenuGroup } from "../ui/dropdown-menu";
import { PricingDialog } from "../PricingDialog";
import { useWorkspace } from "./workspace-context";
import { Button } from "../ui/button";
import {
  BookOpen,
  FolderClosed,
  MapPinIcon,
  Plus,
  Workflow,
} from "lucide-react";
import { NewThreadButton } from "./new-thread-button";
import { usePermissions } from "@/features/permissions/context";
import { MobileWorkspaceSwitcher } from "./mobile-workspace-switcher";
import { SidebarProjectsList } from "./sidebar-projects-list";
import CreateKnowledgeBaseDialog from "@/features/knowledge-bases/components/create-knowledge-base-dialog";
import { CreateProjectDialog } from "@/features/projects/components";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const { activeWorkspace } = useWorkspace();
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const { canCreateOrgKnowledgeBases, canCreateOrgProjects } = usePermissions();

  return (
    <Sidebar collapsible={"icon"} variant="inset" ref={sidebarRef} {...props}>
      <SidebarHeader>
        <SidebarMenu className="flex flex-row items-center group-data-[collapsible=icon]:justify-center justify-between ">
          {isMobile ? (
            <MobileWorkspaceSwitcher />
          ) : (
            <WorkSpaceSwitcher state={state} />
          )}
          {state === "expanded" && <SidebarTrigger />}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              <SidebarMenuItem className="mb-3">
                <NewThreadButton />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarButton
                  href="/workflows"
                  icon={Workflow}
                  hoverIcon={Workflow}
                  label="Workflows"
                />
              </SidebarMenuItem>

              <SidebarMenuItem>
                {!(
                  activeWorkspace?.type === "personal" &&
                  user.subscriptionStatus !== "active"
                ) && (
                  <SidebarButton
                    href="/sites"
                    icon={MapPinIcon}
                    hoverIcon={MapPinIcon}
                    label="Sites"
                  />
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarButton
                  href="/projects"
                  icon={FolderClosed}
                  hoverIcon={FolderClosed}
                  label="Projects"
                  actionTrigger={
                    <CreateProjectDialog
                      trigger={
                        <Button
                          disabled={!canCreateOrgProjects}
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-accent border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
                        >
                          <Plus className="h-6 w-6" />
                        </Button>
                      }
                      organizationId={
                        activeWorkspace?.type === "organization"
                          ? activeWorkspace.id
                          : undefined
                      }
                    />
                  }
                />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarButton
                  href="/knowledge-bases"
                  label="Knowledge Bases"
                  icon={BookOpen}
                  hoverIcon={BookOpen}
                  actionTrigger={
                    <CreateKnowledgeBaseDialog
                      trigger={
                        <Button
                          disabled={!canCreateOrgKnowledgeBases}
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-accent border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
                        >
                          <Plus className="h-6 w-6" />
                        </Button>
                      }
                    />
                  }
                />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <ThreadsLink />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(state === "expanded" || isMobile) && (
          <SidebarProjectsList user={user} />
        )}

        {(state === "expanded" || isMobile) && <ThreadsList user={user} />}
      </SidebarContent>

      <SidebarFooter className="mb-4 md:mb-0">
        <SidebarMenu className="flex flex-col w-full items-center group-data-[collapsible=icon]:justify-center justify-between">
          {state === "collapsed" && !isMobile && (
            <SidebarMenuItem>
              <SidebarTrigger className="mb-3 " />
            </SidebarMenuItem>
          )}

          {state === "expanded" &&
            user.subscriptionStatus !== "active" &&
            activeWorkspace?.type === "personal" && (
              <DropdownMenuGroup className="w-full mb-1">
                <PricingDialog />
              </DropdownMenuGroup>
            )}
          <NavUser user={user} />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
