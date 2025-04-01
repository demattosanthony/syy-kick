"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./workspace-context";
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

export function WorkSpaceSwitcher({
  state,
}: {
  state: "expanded" | "collapsed";
}) {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState<string | null>(
    null
  );
  const [hoveredSiteId, setHoveredSiteId] = useState<string | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  const hoveredWorkspace = workspaces.find((w) => w.id === hoveredWorkspaceId);
  const hoveredSite = hoveredWorkspace?.sites.find(
    (s) => s.id === hoveredSiteId
  );

  const filteredSites =
    hoveredWorkspace?.sites.filter((s) =>
      s.name.toLowerCase().includes(siteSearch.toLowerCase())
    ) || [];

  const filteredProjects =
    hoveredSite?.projects.filter((p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
    ) || [];

  const onProjectSelect = (projectId: string) => {
    const project = hoveredSite?.projects.find((p) => p.id === projectId);
    if (!hoveredSite || !hoveredWorkspace || !project) return;

    setActiveWorkspace(hoveredWorkspace);
    setOpen(false);

    router.push(`/projects/${projectId}`);
  };

  const onSiteSelect = (siteId: string) => {
    const site = hoveredWorkspace?.sites.find((s) => s.id === siteId);
    if (!hoveredWorkspace || !site) return;

    setActiveWorkspace(hoveredWorkspace);
    setOpen(false);

    router.push(`/projects?siteId=${siteId}`);
  };

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
    setOpen(false);
    router.push("/");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 font-normal max-w-[185px]"
        >
          <WorkspaceLogo workspace={activeWorkspace} />
          {state === "expanded" && (
            <>
              <p className="text-sm truncate">
                {activeWorkspace?.name || "Select Workspace"}
              </p>
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex w-fit p-0" align="start" sideOffset={8}>
        {/* Workspace Column */}
        <div className="flex h-[400px] w-[240px] flex-col border-r">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workspaces..."
                className="pl-8"
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredWorkspaces.map((w) => (
              <div
                key={w.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted max-h-10",
                  hoveredWorkspaceId === w.id && "bg-muted"
                )}
                onMouseEnter={() => {
                  setHoveredWorkspaceId(w.id);
                  setHoveredSiteId(null); // Important pour reset les projets
                }}
                onClick={() => handleWorkspaceChange(w)}
              >
                <WorkspaceLogo workspace={w} />
                {w.name}
              </div>
            ))}
          </div>
          <div className="border-t p-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create Organization
                </Button>
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
          </div>
        </div>

        {/* Sites Column */}
        {hoveredWorkspace && (
          <div className="flex h-[400px] w-[240px] flex-col border-r">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sites..."
                  className="pl-8"
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredSites.map((site) => (
                <div
                  key={site.id}
                  className={cn(
                    "px-3 text-sm cursor-pointer hover:bg-muted h-10 flex items-center",
                    hoveredSiteId === site.id && "bg-muted"
                  )}
                  onMouseEnter={() => setHoveredSiteId(site.id)}
                  onClick={() => onSiteSelect(site.id)}
                >
                  {site.name}
                </div>
              ))}
              {filteredSites.length === 0 && (
                <div className="px-3 text-sm text-center text-muted-foreground">
                  No sites found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects Column */}
        {hoveredSite && (
          <div className="flex h-[400px] w-[240px] flex-col">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  className="pl-8"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted h-10 flex items-center"
                  onClick={() => onProjectSelect(project.id)}
                >
                  {project.name}
                </div>
              ))}
              {filteredProjects.length === 0 && (
                <div className="px-3 text-sm text-center text-muted-foreground">
                  No projects found
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const WorkspaceLogo = ({ workspace }: { workspace?: Workspace | null }) => {
  if (!workspace) return null;
  return (
    <div className="flex h-6 w-6 items-center justify-center shrink-0">
      <Avatar className="h-6 w-6 rounded-full bg-transparent">
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
