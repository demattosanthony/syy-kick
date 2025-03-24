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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// API and data fetching imports
import { ApiError } from "@/lib/api";
import { useCreateKnowledgeBase } from "../api";

interface CreateKnowledgeBaseDialogProps {
  trigger: React.ReactNode;
}

const CreateKnowledgeBaseDialog = ({
  trigger,
}: CreateKnowledgeBaseDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const createKnowledgeBaseMutation = useCreateKnowledgeBase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name is provided
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const knowledgeBase = await createKnowledgeBaseMutation.mutateAsync({
        name: formData.name,
        description: formData.description,
      });

      setFormData({
        name: "",
        description: "",
      });
      setOpen(false);

      // Navigate to the newly created knowledge base
      router.push(`/knowledge-bases/${knowledgeBase.id}`);

      // Show success message
      toast.success("Knowledge base created successfully");
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 402) {
          toast.error(
            "Pro or Teams plan is required to create a knowledge base"
          );
          return;
        }
      }
      toast.error("Failed to create knowledge base");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new Knowledge Base</DialogTitle>
          <DialogDescription>
            A knowledge base helps you organize and search through your
            documents
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 ">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="E.g., Equipment Manuals"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={createKnowledgeBaseMutation.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description (optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this knowledge base"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={createKnowledgeBaseMutation.isPending}
              rows={3}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              className="mr-2"
              onClick={() => setOpen(false)}
              disabled={createKnowledgeBaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createKnowledgeBaseMutation.isPending}
            >
              {createKnowledgeBaseMutation.isPending
                ? "Creating..."
                : "Create Knowledge Base"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateKnowledgeBaseDialog;
