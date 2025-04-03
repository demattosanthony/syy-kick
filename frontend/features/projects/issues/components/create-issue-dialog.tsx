"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Assuming you want a description
import { useState } from "react";
import { useCreateIssue } from "../api/create-issue"; // Use the correct relative path
import { toast } from "sonner"; // Assuming you use sonner for toasts

interface CreateIssueDialogProps {
  projectId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CreateIssueDialog({
  projectId,
  isOpen,
  onOpenChange,
}: CreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createIssueMutation = useCreateIssue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      // Basic validation
      toast.error("Title is required.");
      return;
    }

    createIssueMutation.mutate(
      {
        projectId,
        data: { title, description }, // Pass description if needed
      },
      {
        onSuccess: (data) => {
          toast.success(data.message || "Issue created successfully!");
          onOpenChange(false); // Close dialog on success
          // Optionally reset form fields
          setTitle("");
          setDescription("");
        },
        onError: (error) => {
          toast.error(`Failed to create issue: ${error.message}`);
        },
      }
    );
  };

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTitle("");
      setDescription("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Fill in the details for the new issue. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id="create-issue-form">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                required // Add basic HTML validation
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Optional description..."
                rows={4}
              />
            </div>
          </div>
        </form>
        <DialogFooter>
          {/* Add a Cancel button using DialogClose */}
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit" // Submit the form
            form="create-issue-form" // Link button to the form
            disabled={createIssueMutation.isPending || !title} // Disable while submitting or if title is empty
          >
            {createIssueMutation.isPending ? "Saving..." : "Save Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
