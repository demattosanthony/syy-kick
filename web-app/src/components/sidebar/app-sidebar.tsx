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
import { SidebarButton } from "./sidebar-button";
import { DropdownMenuGroup } from "../ui/dropdown-menu";
import { PricingDialog } from "../PricingDialog";
import { useWorkspace } from "@/workspace-context";
import { LinkIcon, FolderIcon } from "lucide-react";
import { NewThreadButton } from "./new-thread-button";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const { activeWorkspace } = useWorkspace();
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  return (
    <Sidebar collapsible={"icon"} ref={sidebarRef} {...props}>
      <SidebarHeader>
        <SidebarMenu className="flex flex-row items-center group-data-[collapsible=icon]:justify-center justify-between ">
          <WorkSpaceSwitcher state={state} />
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
                <ThreadsLink />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarButton
                  href="/files"
                  label="Files"
                  icon={FolderIcon}
                  hoverIcon={FolderIcon}
                />
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarButton
                  href="/integrations"
                  label="Integrations"
                  icon={LinkIcon}
                  hoverIcon={LinkIcon}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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

      <SidebarRail />
    </Sidebar>
  );
}
