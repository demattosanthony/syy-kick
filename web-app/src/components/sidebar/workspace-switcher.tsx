import { useState } from "react";
import { Plus, ChevronsUpDown } from "lucide-react";
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
    <SidebarMenuItem className="w-full">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer w-full flex items-center justify-center"
          >
            <WorkspaceLogo workspace={activeWorkspace} />
            {state === "expanded" && (
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeWorkspace?.name || "Select Workspace"}
                </span>
              </div>
            )}
            {state === "expanded" && (
              <ChevronsUpDown className="ml-auto h-4 w-4" />
            )}
          </SidebarMenuButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="min-w-56 rounded-lg w-[var(--radix-dropdown-menu-trigger-width)]"
          align="start"
          side={isMobile ? "bottom" : "right"}
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-muted-foreground text-xs px-2">
            Workspaces
          </DropdownMenuLabel>
          <div className="max-h-[200px] overflow-y-auto">
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => handleWorkspaceChange(w)}
                className="gap-2 p-2 cursor-pointer"
              >
                <WorkspaceLogo workspace={w} />
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
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="h-4 w-4" />
                </div>
                <div className="font-medium">Create Organization</div>
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
  );
}

const WorkspaceLogo = ({ workspace }: { workspace?: Workspace | null }) => {
  if (!workspace) {
    return (
      <div className="flex h-7 w-7 items-center justify-center shrink-0 rounded-lg bg-muted text-muted-foreground"></div>
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center shrink-0">
      <Avatar className="h-7 w-7 rounded-full bg-transparent">
        <AvatarImage src={workspace?.logo} alt={workspace?.name} />
        <AvatarFallback>
          {workspace?.name
            ?.split(" ")
            .map((n: string) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};
