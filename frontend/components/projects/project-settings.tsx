"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
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

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters"),
});

export default function ProjectSettings({ pid }: { pid: string }) {
  const router = useRouter();

  const { data: project } = useProjectQuery(pid);

  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await updateProjectMutation.mutateAsync({
        projectId: pid,
        data: {
          name: values.name,
          description: values.description,
        },
      });
      toast.success("Settings updated", {
        description: "Your project settings have been updated successfully.",
      });
    } catch (error) {
      toast.error("Failed to update project settings. Please try again.");
    }
  }

  async function handleDeleteProject() {
    try {
      await deleteProjectMutation.mutateAsync(pid);
      toast.success("Project deleted", {
        description: "Your project has been deleted successfully.",
      });
      router.push("/projects");
    } catch (error) {
      toast.error("Failed to delete project. Please try again.");
    } finally {
    }
  }

  // Add this effect to update form values when project data is available
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description,
      });
    }
  }, [project, form]);

  return (
    <div className="flex flex-col h-screen w-full">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-xl mx-auto pt-6 px-6 w-full ">
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
                <Form {...form}>
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
                    <div className="flex justify-end">
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </Form>
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
