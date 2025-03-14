"use client";

// React and Next.js imports
import { useState } from "react";
import { useRouter } from "next/navigation";

// Third-party utility imports
import { toast } from "sonner";

// UI component imports
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Custom component imports
import ProjectFormFields from "./project-form-fields";

// API and data fetching imports
import { ApiError } from "@/lib/api";
import { useCreateProjectMutation } from "../api";

interface CreateProjectDialogProps {
  trigger: React.ReactNode;
}

const CreateProjectDialog = ({ trigger }: CreateProjectDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    projectNumber: "",
    estimatedStartDate: "",
    estimatedEndDate: "",
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

  const createProjectMutation = useCreateProjectMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate location is provided
    if (!formData.location.address) {
      toast.error("Location is required");
      return;
    }

    try {
      const project = await createProjectMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
        project_number: formData.projectNumber,
        estimated_start_date: formData.estimatedStartDate || undefined,
        estimated_end_date: formData.estimatedEndDate || undefined,
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
        projectNumber: "",
        estimatedStartDate: "",
        estimatedEndDate: "",
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
          toast.error("Pro or Teams plan is required to create a project");
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
        <form onSubmit={handleSubmit} className="space-y-4 max-w-[460px]">
          <ProjectFormFields
            formData={formData}
            setFormData={setFormData}
            isSubmitting={createProjectMutation.isPending}
            submitButtonText={
              createProjectMutation.isPending ? "Creating..." : "Create Project"
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
