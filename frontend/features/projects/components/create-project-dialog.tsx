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
import ProjectFormFields, { ProjectFormData } from "./project-form-fields";

// API and data fetching imports
import { ApiError } from "@/lib/api";
import { useCreateProjectMutation } from "../api";

// Permissions
import { usePermissions } from "@/features/permissions/context";

// Types
import { Site } from "@/features/sites/types/sites";
interface CreateProjectDialogProps {
  trigger: React.ReactNode;
  organizationId?: string;
  site?: Site;
}

const CreateProjectDialog = ({ trigger, organizationId, site }: CreateProjectDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    site,
    organizationId,
    name: "",
    description: "",
    projectNumber: "",
    estimatedStartDate: "",
    estimatedEndDate: "",
    location: {
      placeId: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      latitude: undefined,
      longitude: undefined,
    }
  });

  const createProjectMutation = useCreateProjectMutation();
  const { canCreateOrgProjects } = usePermissions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.site?.id && (!formData.location.address || !formData.location.city || !formData.location.postalCode || !formData.location.country)) {
      toast.error("Please select a site or enter a location");
      return;
    }

    try {
      const project = await createProjectMutation.mutateAsync({
        siteId: formData.site?.id,
        place_id: formData.location.placeId,
        organizationId,
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
      });

      setFormData({
        site: undefined,
        organizationId,
        name: "",
        description: "",
        projectNumber: "",
        estimatedStartDate: "",
        estimatedEndDate: "",
        location: {
          placeId: "",
          address: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
          latitude: undefined,
          longitude: undefined,
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
      <DialogTrigger asChild disabled={!canCreateOrgProjects}>
        {trigger}
      </DialogTrigger>
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
