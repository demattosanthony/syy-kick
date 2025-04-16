"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWorkspace } from "./workspace-context";
import { CreateOrgForm } from "@/features/organizations/components";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Workspace } from "@/types/workspace";

export function MobileWorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

  const [step, setStep] = useState<"workspace" | "site" | "project">(
    "workspace"
  );
  const [open, setOpen] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(
    null
  );
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");

  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  const selectedSite = selectedWorkspace?.sites.find(
    (s) => s.id === selectedSiteId
  );

  const filteredSites =
    selectedWorkspace?.sites.filter((s) =>
      s.address.toLowerCase().includes(siteSearch.toLowerCase())
    ) || [];

  const filteredProjects =
    selectedSite?.projects.filter((p) =>
      p.name.toLowerCase().includes(projectSearch.toLowerCase())
    ) || [];

  const onProjectSelect = (projectId: string) => {
    const project = selectedSite?.projects.find((p) => p.id === projectId);
    if (!selectedSite || !selectedWorkspace || !project) return;

    setActiveWorkspace(selectedWorkspace);
    setOpen(false);
    setStep("workspace");

    router.push(`/projects/${project.id}`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // reset state when closed
          setStep("workspace");
          setSelectedWorkspace(null);
          setSelectedSiteId(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 font-normal w-full justify-between"
        >
          {activeWorkspace?.name || "Select Workspace"}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="h-[90vh] overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            {step !== "workspace" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (step === "project") setStep("site");
                  if (step === "site") setStep("workspace");
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <h2 className="text-lg font-medium capitalize">{step}</h2>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {step === "workspace" && (
            <>
              <Input
                placeholder="Search workspaces..."
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
              />
              {filteredWorkspaces.map((w) => (
                <button
                  key={w.id}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-muted"
                  onClick={() => {
                    setSelectedWorkspace(w);
                    setStep("site");
                    setWorkspaceSearch("");
                  }}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={w.logo} />
                    <AvatarFallback>
                      {w.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left text-sm">
                    {w.name}
                    {w.type === "personal" && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (Personal)
                      </span>
                    )}
                  </div>
                </button>
              ))}

              <div className="border-t pt-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="h-4 w-4" />
                      Create Organization
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-none w-fit pt-2 pb-8">
                    <DialogTitle>Create Organization</DialogTitle>
                    <CreateOrgForm
                      onComplete={() => setOpen(false)}
                      showBackButton={false}
                      includeSamlSetup={false}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}

          {step === "site" && selectedWorkspace && (
            <>
              <Input
                placeholder="Search sites..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
              />
              {filteredSites.map((site) => (
                <button
                  key={site.id}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
                  onClick={() => {
                    setSelectedSiteId(site.id);
                    setStep("project");
                    setSiteSearch("");
                  }}
                >
                  {site.address}
                </button>
              ))}
            </>
          )}

          {step === "project" && selectedSite && (
            <>
              <Input
                placeholder="Search projects..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className="w-full text-left px-3 py-2 rounded hover:bg-muted text-sm"
                  onClick={() => onProjectSelect(project.id)}
                >
                  {project.name}
                </button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
