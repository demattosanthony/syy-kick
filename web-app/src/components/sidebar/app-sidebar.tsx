import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
import { Button } from "../ui/button";
import {
  BookOpen,
  MapPinIcon,
  Plus,
  Workflow,
  LinkIcon,
  Brain,
  House,
  LucideIcon,
  ChevronRight,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { NewThreadButton } from "./new-thread-button";
import { usePermissions } from "@/features/permissions/context";
import { MobileWorkspaceSwitcher } from "./mobile-workspace-switcher";
import { CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Collapsible } from "../ui/collapsible";

const products: {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
}[] = [
  {
    title: "AI Engineer",
    url: "/ai-engineer",
    icon: Brain,
    isActive: true,
    items: [
      {
        title: "New Chat",
        url: "/",
      },
      {
        title: "Chat History",
        url: "/threads",
      },
    ],
  },
  {
    title: "Workflows",
    url: "/workflows",
    icon: Workflow,
    isActive: true,
    items: [
      {
        title: "View All",
        url: "/workflows",
      },
      {
        title: "Workflow History",
        url: "/workflows",
      },
    ],
  },
];

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const { activeWorkspace } = useWorkspace();
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const location = useLocation();

  return (
    <Sidebar collapsible={"icon"} variant="inset" ref={sidebarRef} {...props}>
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
                  href="/workflows"
                  icon={Workflow}
                  hoverIcon={Workflow}
                  label="Workflows"
                />
              </SidebarMenuItem>
              {/* 
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
              </SidebarMenuItem> */}

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

        {/* <SidebarGroup>
          <SidebarGroupLabel>Products</SidebarGroupLabel>
          <SidebarMenu>
            {products.map((item) => (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={item.isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.title}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="w-full">
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild className="h-8">
                            <Link to={subItem.url}>
                              <span
                                className={
                                  location.pathname === subItem.url
                                    ? "text-primary"
                                    : ""
                                }
                              >
                                {subItem.title}
                              </span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup> */}

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
