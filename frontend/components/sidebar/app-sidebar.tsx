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
import { NewThreadButton } from "./new-thread-button";
import { ThreadsList } from "./sidebar-threads-list";
import { ThreadsLink } from "./threads-link";
import { SidebarProjectsList } from "./sidebar-projects-list";
import { ProjectsButton } from "./projects-button";
import { DropdownMenuGroup } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { useAtom } from "jotai";
import { pricingPlanDialogOpenAtom } from "../PricingDialog";
import { useWorkspace } from "./workspace-context";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const [, setShowPricingPlanDialog] = useAtom(pricingPlanDialogOpenAtom);
  const { activeWorkspace } = useWorkspace();

  return (
    <Sidebar collapsible={"icon"} {...props}>
      <SidebarHeader>
        <SidebarMenu className="flex flex-row items-center group-data-[collapsible=icon]:justify-center justify-between">
          <WorkSpaceSwitcher />

          {state === "expanded" && <SidebarTrigger />}
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
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
                <ProjectsButton />
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
        {state === "collapsed" && !isMobile && (
          <SidebarTrigger className="w-full" />
        )}

        {state === "expanded" &&
          user.subscriptionStatus !== "active" &&
          activeWorkspace?.type === "personal" && (
            <DropdownMenuGroup>
              <Button
                className="w-full"
                variant={"default"}
                onClick={(e) => {
                  console.log("Upgrade to Pro");
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPricingPlanDialog(true);
                }}
              >
                Upgrade to Pro
              </Button>
            </DropdownMenuGroup>
          )}

        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
