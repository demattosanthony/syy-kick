"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  useDeleteProjectMutation,
  useProjectQuery,
  useUpdateProjectMutation,
} from "@/queries/queries";
import { LocationSearch } from "../location-search";

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  location: z
    .object({
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
    })
    .optional(),
});

export default function ProjectSettings({ pid }: { pid: string }) {
  const router = useRouter();

  const { data: project } = useProjectQuery(pid);

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit", // Only validate on submit
    defaultValues: {
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
    },
  });

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await updateProjectMutation.mutateAsync({
        projectId: pid,
        data: {
          name: values.name,
          description: values.description,
          address: values.location?.address || undefined,
          city: values.location?.city || undefined,
          state: values.location?.state || undefined,
          country: values.location?.country || undefined,
          postalCode: values.location?.postalCode || undefined,
          latitude: values.location?.latitude || undefined,
          longitude: values.location?.longitude || undefined,
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
      form.reset({
        name: project.name,
        description: project.description || undefined,
        location: {
          address: project.address || undefined,
          city: project.city || undefined,
          state: project.state || undefined,
          country: project.country || undefined,
          postalCode: project.postalCode || undefined,
          latitude: project.latitude || undefined,
          longitude: project.longitude || undefined,
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
                {/* Remove the Form component wrapper */}
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <div>
                        <Label className="text-muted-foreground text-sm">
                          Project Name
                        </Label>
                        <Input {...field} />
                      </div>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <div>
                        <Label className="text-muted-foreground text-sm">
                          Description
                        </Label>
                        <Textarea
                          {...field}
                          placeholder="Enter a description for your project"
                        />
                      </div>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <div>
                        <Label className="text-muted-foreground text-sm">
                          Location
                        </Label>
                        <LocationSearch
                          value={field.value || {}}
                          onChange={(locationData) => {
                            field.onChange(locationData);
                          }}
                        />
                      </div>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateProjectMutation.isPending}
                    >
                      {updateProjectMutation.isPending
                        ? "Saving..."
                        : "Save Changes"}
                    </Button>
                  </div>
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
