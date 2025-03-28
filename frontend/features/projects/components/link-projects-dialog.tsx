"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SitesSelector } from "@/features/sites/components";
import type { Project } from "@/types/project";
import { CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useLinkProjectMutation from "@/features/sites/api/link-projects";
import { toast } from "sonner";
import { CheckedState } from "@radix-ui/react-checkbox";

// Define the form schema with Zod
const linkProjectsSchema = z.object({
  siteId: z.string({
    required_error: "Please select a site",
  }),
  projectsIds: z.array(z.string()).min(1, "Please select at least one project"),
});

type LinkProjectsFormValues = z.infer<typeof linkProjectsSchema>;

export default function LinkProjectDialog({
  unlinkedProjects,
}: {
  unlinkedProjects: Project[];
}) {
  const [open, setOpen] = useState(false);
  const {
    mutate: linkProject,
    isPending,
    isError,
    error,
    isSuccess,
    data,
  } = useLinkProjectMutation();

  const form = useForm<LinkProjectsFormValues>({
    resolver: zodResolver(linkProjectsSchema),
    defaultValues: {
      siteId: "",
      projectsIds: [],
    },
  });

  const handleSelectAll = () => {
    const currentProjectIds = form.getValues("projectsIds");
    if (currentProjectIds.length === unlinkedProjects.length) {
      form.setValue("projectsIds", [], { shouldValidate: true });
    } else {
      form.setValue(
        "projectsIds",
        unlinkedProjects.map((project) => project.id),
        { shouldValidate: true }
      );
    }
  };

  useEffect(() => {
    if (isSuccess && data) {
      toast.success(data.message);
      setOpen(false);
    }

    if (isError && error) {
      toast.error(error.message);
    }
  }, [isSuccess, isError, error, data]);

  return (
    <Card className="relative flex flex-col items-start w-full max-w-[640px] bg-red-100 border border-red-200 text-red-900 mb-2">
      <div className="p-4">
        <div className="flex gap-2 items-center">
          <CircleAlert className="h-6 w-6 text-red-900" />
          <h2 className="text-lg font-semibold">Unlinked projects</h2>
        </div>
        <p className="text-sm mt-2">
          You have {unlinkedProjects.length} project
          {unlinkedProjects.length !== 1 ? "s" : ""} that{" "}
          {unlinkedProjects.length !== 1 ? "are" : "is"} not linked to any
          site.
        </p>
        <Dialog
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) form.reset();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-2 border border-red-900">
              Link projects
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Link projects to sites</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(() => {
                  linkProject({
                    siteId: form.watch("siteId"),
                    data: { projectsIds: form.watch("projectsIds") },
                  });
                })}
                className="space-y-4 py-4"
              >
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Select a site</FormLabel>
                      <FormControl>
                        <SitesSelector
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectsIds"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center justify-between">
                        <FormLabel>Select projects</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAll}
                          disabled={isPending}
                        >
                          {field.value.length === unlinkedProjects.length
                            ? "Deselect all"
                            : "Select all"}
                        </Button>
                      </div>
                      <FormControl>
                        <ScrollArea className="h-[200px] rounded-md border">
                          <div className="p-4 space-y-2">
                            {unlinkedProjects.map((project) => (
                              <div
                                key={project.id}
                                className="flex items-start space-x-2"
                              >
                                <Checkbox
                                  id={`project-${project.id}`}
                                  checked={field.value.includes(project.id)}
                                  onCheckedChange={(
                                    checked: CheckedState
                                  ) => {
                                    const updatedValue = checked
                                      ? [...field.value, project.id]
                                      : field.value.filter(
                                        (id) => id !== project.id
                                      );
                                    field.onChange(updatedValue);
                                  }}
                                  disabled={isPending}
                                />
                                <div className="grid gap-1.5 leading-none">
                                  <label
                                    htmlFor={`project-${project.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {project.name}
                                  </label>
                                  {project.description && (
                                    <p className="text-xs text-muted-foreground">
                                      {project.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {field.value.length} of {unlinkedProjects.length}{" "}
                        projects selected
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      `Link ${form.watch("projectsIds").length} project${form.watch("projectsIds").length !== 1 ? "s" : ""
                      }`
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
