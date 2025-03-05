"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WorkflowHeader from "./workflow-header";
import WorkflowViewer from "./workflow-viewer";
import { useDeleteWorkflowMutation, useWorkflowQuery } from "../api";

export default function WorkflowPageContent({
  workflowId,
}: {
  workflowId: string;
}) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: workflow, isLoading, error } = useWorkflowQuery(workflowId);
  const deleteWorkflow = useDeleteWorkflowMutation();

  const handleDeleteWorkflow = async () => {
    try {
      await deleteWorkflow.mutateAsync(workflowId);
      router.push("/workflows");
    } catch (error) {
      // Error handling
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Workflow not found</h2>
        <Button onClick={() => router.push("/workflows")}>
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <WorkflowHeader
        workflow={workflow}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        onDelete={handleDeleteWorkflow}
        deleteWorkflowMutation={deleteWorkflow}
        router={router}
      />
      <WorkflowViewer workflow={workflow} />
    </div>
  );
}
