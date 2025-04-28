"use client";

/** React and Next.js imports */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

/** Third-party utility imports */
import { toast } from "sonner";

/** UI components */
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

/** API and data fetching */
import {
  useDeleteProjectMutation,
  useProjectQuery,
  useUpdateProjectMutation,
} from "../api";
import { useMeQuery } from "@/features/user/api";

/** Custom component imports */
import ProjectFormFields, { ProjectFormData } from "./project-form-fields";
import { usePermissions } from "@/features/permissions/context";
import { AccessLogs } from "@/features/organizations/components";

/** Utils */
import { PermissionsConstants } from "@/features/permissions/utils";

/** Types */
import { Permissions } from "@/types/permissions";
import { AccessLogStatus } from "@/features/organizations/types";

const ProjectSettings = ({ pid }: { pid: string }) => {
  const navigate = useNavigate();

  const { data: user } = useMeQuery();
  const { data: project } = useProjectQuery(pid);

  const { canDeleteOrgProjects, canReadOrgProjectAccessLogs } =
    usePermissions();

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const [formData, setFormData] = useState<ProjectFormData>({
    site: undefined,
    name: "",
    location: {
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      placeId: "",
    },
    description: project?.description || "",
    projectNumber: project?.projectNumber || "",
    estimatedStartDate: project?.estimatedStartDate || "",
    estimatedEndDate: project?.estimatedEndDate || "",
  });

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProjectMutation.mutateAsync({
        projectId: pid,
        data: {
          organizationId: project?.organizationId,
          siteId: formData.site?.id,
          address: formData.location.address,
          city: formData.location.city,
          state: formData.location.state,
          country: formData.location.country,
          postalCode: formData.location.postalCode,
          latitude: formData.location.latitude,
          longitude: formData.location.longitude,
          placeId: formData.location.placeId,
          name: formData.name,
          description: formData.description,
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
      navigate("/projects");
    } catch {
      toast.error("Failed to delete project. Please try again.");
    } finally {
    }
  }

  // Load form values
  useEffect(() => {
    if (project) {
      setFormData({
        site: project.site,
        location: {
          address: "",
          city: "",
          state: "",
          country: "",
          postalCode: "",
          latitude: undefined,
          longitude: undefined,
          placeId: "",
        },
        name: project.name || "",
        description: project.description || "",
        projectNumber: project.projectNumber || "",
        estimatedStartDate: project.estimatedStartDate || "",
        estimatedEndDate: project.estimatedEndDate || "",
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

            {canReadOrgProjectAccessLogs && project?.organizationId && user && (
              <AccessLogs
                organizationId={project.organizationId}
                projectId={pid}
                resources={Object.entries(Permissions.Resources).filter(
                  ([_, value]) =>
                    PermissionsConstants.OrganizationProjectResources.includes(
                      value
                    )
                )}
                actions={Object.entries(Permissions.Actions)}
                status={Object.entries(AccessLogStatus)}
                user={user}
                type="project"
              />
            )}

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
                  <Button
                    disabled={!canDeleteOrgProjects}
                    variant="destructive"
                  >
                    Delete Project
                  </Button>
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
};

export default ProjectSettings;
