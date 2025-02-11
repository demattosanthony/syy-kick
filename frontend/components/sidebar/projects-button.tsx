"use client";

import { FolderClosed, FolderOpen, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { useSidebar } from "../ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useCreateProjectMutation } from "@/queries/queries";
import { useState } from "react";
import { useWorkspace } from "./workspace-context";

export function ProjectsButton() {
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { activeWorkspace } = useWorkspace();
  const isProjectsPage = pathname === "/projects";

  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const createProjectMutation = useCreateProjectMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProjectMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        organizationId:
          activeWorkspace?.type === "organization"
            ? activeWorkspace.id
            : undefined,
      });
      setFormData({ name: "", description: "" });
      setOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  return (
    <div className="relative group/projects">
      <Button
        variant={"ghost"}
        onClick={() => {
          isMobile && toggleSidebar();
          router.push("/projects");
        }}
        className={cn(
          "w-full px-2 transition-all",
          state === "collapsed" && !isMobile
            ? "justify-center"
            : "justify-start",
          isProjectsPage && "bg-accent text-accent-foreground"
        )}
      >
        {state === "collapsed" && !isMobile ? (
          <FolderClosed />
        ) : (
          <>
            <FolderClosed className="group-hover/projects:hidden" />
            <FolderOpen className="hidden group-hover/projects:block" />
            Projects
          </>
        )}
      </Button>

      {state === "expanded" && !isMobile && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover/projects:opacity-100 hover:bg-accent border-none ring-0 focus-visible:ring-0 focus:ring-0 text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new Project</DialogTitle>
              <DialogDescription></DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Project name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Project description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                >
                  {createProjectMutation.isPending
                    ? "Creating..."
                    : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
