import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useWorkspace } from "@/workspace-context";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { CreateOrgForm } from "@/features/organizations/components";
import api from "@/lib/api";
import { PRICING_PLANS } from "@/lib/pricing";
import { Workspace } from "@/types/workspace";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

export function WorkSpaceSwitcher({
  state,
}: {
  state: "expanded" | "collapsed";
}) {
  const navigate = useNavigate();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { isMobile } = useSidebar();

  const [open, setOpen] = useState(false);

  const handleCreateOrgComplete = async (org: {
    id: string;
    seats: number;
  }) => {
    const url = await api.payments.createCheckoutSession(
      PRICING_PLANS.TEAMS.lookup_key,
      org.seats,
      org.id
    );
    window.location.href = url;
  };

  const handleWorkspaceChange = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    setOpen(false);
    navigate("/");
  };

  if (!activeWorkspace) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "w-full flex items-center",
                state === "expanded" ? "justify-start" : "justify-center"
              )}
            >
              <WorkspaceLogo workspace={activeWorkspace} />
              {state === "expanded" && (
                <span className="truncate font-medium">
                  {activeWorkspace?.name || "Select Workspace"}
                </span>
              )}
              {state === "expanded" && <ChevronDown className="opacity-50" />}
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            <div className="max-h-[200px] overflow-y-auto">
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onClick={() => handleWorkspaceChange(w)}
                  className="gap-2 p-2 cursor-pointer"
                >
                  <div className="flex size-6 items-center justify-center">
                    <WorkspaceIcon workspace={w} />
                  </div>
                  {w.name}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <Dialog>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  className="gap-2 p-2 cursor-pointer"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground font-medium">
                    Create Organization
                  </div>
                </DropdownMenuItem>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

const WorkspaceLogo = ({ workspace }: { workspace?: Workspace | null }) => {
  if (!workspace) {
    return (
      <div className="flex aspect-square size-6 items-center justify-center rounded-md"></div>
    );
  }
  return (
    <div className="flex aspect-square size-6 items-center justify-center rounded-md">
      <Avatar className="size-6 rounded-full bg-transparent">
        <AvatarImage src={workspace?.logo} alt={workspace?.name} />
        <AvatarFallback className="text-xs">
          {workspace?.name
            ?.split(" ")
            .map((n: string) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

const WorkspaceIcon = ({ workspace }: { workspace?: Workspace | null }) => {
  if (!workspace) {
    return null;
  }
  return (
    <Avatar className="size-5 rounded-full bg-transparent shrink-0">
      <AvatarImage src={workspace?.logo} alt={workspace?.name} />
      <AvatarFallback className="text-xs">
        {workspace?.name
          ?.split(" ")
          .map((n: string) => n[0])
          .join("")}
      </AvatarFallback>
    </Avatar>
  );
};
