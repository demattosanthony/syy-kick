"use client";

// React and Next.js imports
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Third-party utility imports
import { toast } from "sonner";

// UI component imports
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// API and data fetching imports
import {
  useDeleteProjectMutation,
  useProjectQuery,
  useUpdateProjectMutation,
} from "@/queries/queries";
import { ProjectFormFields } from "./project-form-fields";

export default function ProjectSettings({ pid }: { pid: string }) {
  const router = useRouter();

  const { data: project } = useProjectQuery(pid);

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

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

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProjectMutation.mutateAsync({
        projectId: pid,
        data: {
          name: formData.name,
          description: formData.description,
          address: formData.location?.address || undefined,
          city: formData.location?.city || undefined,
          state: formData.location?.state || undefined,
          country: formData.location?.country || undefined,
          postalCode: formData.location?.postalCode || undefined,
          latitude: formData.location?.latitude || undefined,
          longitude: formData.location?.longitude || undefined,
          project_number: formData.projectNumber || undefined,
          estimated_start_date: formData.estimatedStartDate || undefined,
          estimated_end_date: formData.estimatedEndDate || undefined,
        },
      });

      toast.success("Settings updated", {
        description: "Your project settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update project settings:", error);
      toast.error("Failed to update project settings. Please try again.");
    }
  };
  async function handleDeleteProject() {
    try {
      await deleteProjectMutation.mutateAsync(pid);
      toast.success("Project deleted", {
        description: "Your project has been deleted successfully.",
      });
      router.push("/projects");
    } catch {
      toast.error("Failed to delete project. Please try again.");
    } finally {
    }
  }

  // Load form values
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || "",
        estimatedEndDate: project.estimatedEndDate || "",
        estimatedStartDate: project.estimatedStartDate || "",
        projectNumber: project.projectNumber || "",
        location: {
          address: project.address || "",
          city: project.city || "",
          state: project.state || "",
          country: project.country || "",
          postalCode: project.postalCode || "",
          latitude: project.latitude || "",
          longitude: project.longitude || "",
        },
      });
    }
  }, [project]);

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto pt-6 px-6 w-full ">
          <div className="space-y-6 pb-10 w-full">
            {/* Project Details Section */}
            <section className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-xl font-medium">Project Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your project settings and configuration.
                </p>
              </div>

              <Card className="p-6">
                <form onSubmit={onSubmit} className="space-y-4">
                  <ProjectFormFields
                    formData={formData}
                    setFormData={setFormData}
                    isSubmitting={updateProjectMutation.isPending}
                    submitButtonText={
                      updateProjectMutation.isPending
                        ? "Saving..."
                        : "Save Changes"
                    }
                  />
                </form>
              </Card>
            </section>

            {/* Danger Zone Section */}
            <section className="flex items-center justify-between px-2">
              <div className="space-y-1">
                <h2 className="text-base font-medium">Danger Zone</h2>
                <p className="text-sm text-muted-foreground">
                  Delete your project and all its data permanently.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete Project</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your project and all associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteProject}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
