"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateIssue } from "@/features/projects/issues/api/create-issue";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { IssueEditor } from "@/features/projects/issues/components/issue-editor";

export default function NewIssuePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createIssueMutation = useCreateIssue();

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
        },
      },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Issue created successfully!");
          // Navigate first, then reset state
          router.push(`/projects/${projectId}/issues`);
          // Resetting state for the form
          setTitle("");
          setDescription(""); // Reset description state
          // Editor content reset is handled internally by IssueEditor via initialContent prop if needed,
          // but resetting state here ensures it's clear for next potential load.
        },
        onError: (error) => {
          toast.error(`Failed to create issue: ${error.message}`);
        },
      }
    );
  };
  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-xl font-bold mb-4">Create new issue</h1>
      <form onSubmit={handleSubmit} className="space-y-8">
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
        <div className="flex gap-3 justify-end">
          <Button
            type="submit"
            disabled={createIssueMutation.isPending || !title}
          >
            Create Issue
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/issues`)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
