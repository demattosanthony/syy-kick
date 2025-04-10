"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateIssue } from "@/features/projects/issues/api/create-issue";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { IssueEditor } from "@/features/projects/issues/components/issue-editor";
import { useProjectMembersQuery } from "@/features/projects/api/get-project-members";
import { AssigneeSelector } from "@/features/projects/issues/components/assignee-selector";

export default function NewIssuePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const createIssueMutation = useCreateIssue();
  const membersQuery = useProjectMembersQuery(projectId);

  const memberOptions =
    membersQuery.data?.map((member) => ({
      label: member.name || member.email,
      value: member.id,
      avatar: member.profilePicture,
    })) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error("Title is required.");
      return;
    }

    createIssueMutation.mutate(
      {
        projectId,
        data: {
          title,
          description,
          assignees: selectedAssignees,
        },
      },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Issue created successfully!");
          router.push(`/projects/${projectId}/issues`);

          // Resetting state for the form
          setTitle("");
          setDescription("");
          setSelectedAssignees([]);
        },
        onError: (error) => {
          toast.error(`Failed to create issue: ${error.message}`);
        },
      }
    );
  };
  return (
    <div className="container max-w-5xl py-8">
      <h1 className="text-xl font-bold mb-4">Create new issue</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">
                Add a title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/50"
                placeholder="Title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">
                Add a description
              </Label>
              <IssueEditor
                initialContent={description}
                onCancel={() =>
                  console.log("Cancel not implemented for new issue form")
                }
                onChange={setDescription}
                placeholder="Type your description here..."
                isLoading={createIssueMutation.isPending}
                showControls={false}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/projects/${projectId}/issues`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createIssueMutation.isPending || !title}
            >
              Create Issue
            </Button>
          </div>
        </form>

        <aside className="md:col-span-1 space-y-6">
          <div className="space-y-2 p-4">
            {membersQuery.isError ? (
              <p className="text-red-500">Error loading members.</p>
            ) : (
              <AssigneeSelector
                memberOptions={memberOptions}
                isLoadingMembers={membersQuery.isLoading}
                currentAssigneeIds={selectedAssignees}
                onAssigneesChange={setSelectedAssignees}
                isUpdating={createIssueMutation.isPending}
                showSelectedInline={true}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
