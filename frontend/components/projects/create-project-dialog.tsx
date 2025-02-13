"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProjectMutation } from "@/queries/queries";
import { useWorkspace } from "@/components/sidebar/workspace-context";

interface CreateProjectDialogProps {
  trigger: React.ReactNode;
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const { activeWorkspace } = useWorkspace();
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
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
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending
                ? "Creating..."
                : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
