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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { LocationSearch } from "../location-search";

interface CreateProjectDialogProps {
  trigger: React.ReactNode;
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    location: {
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      latitude: "",
      longitude: "",
    },
  });

  const { activeWorkspace } = useWorkspace();
  const createProjectMutation = useCreateProjectMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const project = await createProjectMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        organizationId:
          activeWorkspace?.type === "organization"
            ? activeWorkspace.id
            : undefined,
        address: formData.location.address,
        city: formData.location.city,
        state: formData.location.state,
        country: formData.location.country,
        postalCode: formData.location.postalCode,
        latitude: formData.location.latitude,
        longitude: formData.location.longitude,
      });
      setFormData({
        name: "",
        description: "",
        location: {
          address: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
          latitude: "",
          longitude: "",
        },
      });
      setOpen(false);
      router.push(`/projects/${project.id}`);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        console.log(error.status);
        if (error.status === 402) {
          toast.error("Pro plan is required to create a project");
          return;
        }
      }
      toast.error("Failed to create project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
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
          <div className="space-y-2 max-w-[460px]">
            <Label htmlFor="location">Location</Label>
            <LocationSearch
              value={formData.location}
              onChange={(locationData) =>
                setFormData((prev) => ({
                  ...prev,
                  location: {
                    address: locationData.address || "",
                    city: locationData.city || "",
                    state: locationData.state || "",
                    country: locationData.country || "",
                    postalCode: locationData.postalCode || "",
                    latitude: locationData.latitude || "",
                    longitude: locationData.longitude || "",
                  },
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
