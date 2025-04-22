"use client";

import { WorkflowsList } from "@/features/workflows/components";
import { useParams } from "next/navigation";

export default function ProjectWorkflowsPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();

  return (
    <div className="flex-1 max-w-3xl mx-auto p-4 w-full">
      <WorkflowsList projectId={projectId} />
    </div>
  );
}
