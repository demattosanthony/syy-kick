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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import { useIsMobile } from "@/hooks/use-mobile";
import { User } from "@/types/user";
import { WorkSpaceSwitcher } from "./workspace-switcher";
import { ThreadsList } from "./sidebar-threads-list";
import { ThreadsLink } from "./threads-link";
import { SidebarProjectsList } from "./sidebar-projects-list";
import { SidebarButton } from "./sidebar-button";
import { DropdownMenuGroup } from "../ui/dropdown-menu";
import { PricingDialog } from "../PricingDialog";
import { useWorkspace } from "./workspace-context";
import { Button } from "../ui/button";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  FolderClosed,
  FolderOpen,
  Plus,
  Workflow,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { CreateProjectDialog } from "@/features/projects/components";
import { NewThreadButton } from "./new-thread-button";
import { scrollbarStyle } from "@/lib/utils";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { state, setOpen, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const { activeWorkspace } = useWorkspace();
  const [isPinned, setIsPinned] = React.useState(true);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  // Keep pin state in sync with sidebar state
  React.useEffect(() => {
    if (state === "collapsed") {
      setIsPinned(false);
    }
  }, [state]);

  // Handle hover behavior
  const handleMouseEnter = React.useCallback(() => {
    if (state === "collapsed" && !isMobile) {
      setOpen(true);
    }
  }, [state, isMobile, setOpen]);

  const handleMouseLeave = React.useCallback(() => {
    if (state === "expanded" && !isPinned && !isMobile && !isPopoverOpen) {
      setOpen(false);
    }
  }, [isPinned, state, isMobile, setOpen, isPopoverOpen]);

  // Toggle pin state
  const togglePin = React.useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  return (
    <Sidebar
      collapsible={"icon"}
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu className="flex flex-row items-center group-data-[collapsible=icon]:justify-center justify-between">
          <WorkSpaceSwitcher onDropdownOpenChange={setIsPopoverOpen} />

          {state === "expanded" && (
            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={togglePin} variant={"ghost"} size={"icon"}>
                    {isPinned ? <ArrowLeftToLine /> : <ArrowRightToLine />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPinned ? "Unpin sidebar" : "Pin sidebar"}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className={scrollbarStyle}>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <NewThreadButton />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <ThreadsLink />
              </SidebarMenuItem>

              <SidebarMenuItem>
                {!(
                  activeWorkspace?.type === "personal" &&
                  user.subscriptionStatus !== "active"
                ) && (
                  <SidebarButton
                    href="/projects"
                    icon={FolderClosed}
                    hoverIcon={FolderOpen}
                    label="Projects"
                    actionTrigger={
                      <CreateProjectDialog
                        trigger={
                          <Button
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-accent border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
                          >
                            <Plus className="h-6 w-6" />
                          </Button>
                        }
                      />
                    }
                  />
                )}
              </SidebarMenuItem>

              {activeWorkspace?.type === "organization" && (
                <SidebarMenuItem>
                  <SidebarButton
                    href="/workflows"
                    icon={Workflow}
                    hoverIcon={Workflow}
                    label="Workflows"
                  />
                </SidebarMenuItem>
              )}
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
              <SidebarTrigger className=" mb-1" />
            </SidebarMenuItem>
          )}

          {state === "expanded" &&
            user.subscriptionStatus !== "active" &&
            activeWorkspace?.type === "personal" && (
              <DropdownMenuGroup className="w-full mb-1">
                <PricingDialog />
              </DropdownMenuGroup>
            )}

          <NavUser user={user} onDropdownOpenChange={setIsPopoverOpen} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
