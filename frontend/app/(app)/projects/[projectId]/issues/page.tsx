"use client";

import { IssuesList } from "@/features/projects/issues/components/issues-list";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreateIssueDialog } from "@/features/projects/issues/components/create-issue-dialog";

export default function ProjectIssuesPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Input placeholder="Search issues..." className="max-w-sm" />
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          Create Issue
        </Button>
      </div>
      <IssuesList projectId={projectId} />
      <CreateIssueDialog
        projectId={projectId}
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
