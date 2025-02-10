"use client";

import * as React from "react";
import { Building, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useMeQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { CreateOrgForm } from "../organizations/create-org-form";
import api from "@/lib/api";
import { Workspace } from "@/types/workspace";
import { useWorkspace } from "./workspace-context";
import { Skeleton } from "../ui/skeleton";
import { useRouter } from "next/navigation";
import { PRICING_PLANS } from "@/lib/pricing";

export function WorkSpaceSwitcher() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { data: user } = useMeQuery();

  const { setActiveWorkspace, activeWorkspace, workspaces } = useWorkspace();

  const handleCreateOrgComplete = async (org: {
    id: string;
    seats: number;
  }) => {
    // go to checkout for the org
    const url = await api.payments.createCheckoutSession(
      PRICING_PLANS.TEAMS.lookup_key,
      org.seats,
      org.id
    );
    window.location.href = url;
  };

  const handleWorkspaceChange = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    router.push("/");
  };

  const WorkspaceLogo = ({ workspace }: { workspace: Workspace }) => {
    if (workspace.type === "personal") {
      return (
        <div className="flex h-6 w-6 items-center justify-center shrink-0">
          <Avatar className="h-6 w-6 rounded-full bg-transparent">
            <AvatarImage src={user?.profilePicture} alt={user?.name} />
            <AvatarFallback>
              {user?.name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        </div>
      );
    }

    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0">
        {workspace.logo ? (
          <img
            src={workspace.logo}
            alt={workspace.name}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <Building className="h-4 w-4 rounded-full" />
        )}
      </div>
    );
  };

  if (!activeWorkspace) {
    return (
      <Skeleton className="h-6 group-data-[collapsible=icon]:w-6 w-36 group-data-[collapsible=icon]:rounded-full" />
    );
  }

  return (
    <SidebarMenuItem className="flex items-center flex-col">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex w-full group-data-[collapsible=icon]:justify-center justify-start items-center gap-2 px-1">
            <WorkspaceLogo workspace={activeWorkspace} />
            <div className="grid text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">
                {activeWorkspace.name}
              </span>
            </div>
            <ChevronDown className="opacity-50 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          side={isMobile ? "bottom" : "right"}
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch workspace
          </DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={handleWorkspaceChange.bind(null, workspace)}
              className="gap-2 p-2"
            >
              <WorkspaceLogo workspace={workspace} />
              <div className="flex flex-col">
                <span>{workspace.name}</span>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="gap-2 p-2"
          >
            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
              <Plus className="size-4" />
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="font-medium text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  Create organization
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-none w-fit pt-2 pb-8">
                <DialogTitle className="h-0 p-0" />
                <CreateOrgForm
                  onComplete={handleCreateOrgComplete}
                  showBackButton={false}
                  includeSamlSetup={false}
                />
              </DialogContent>
            </Dialog>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
