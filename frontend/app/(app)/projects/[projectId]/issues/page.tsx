"use client";

import { IssuesList } from "@/features/projects/issues/components/issues-list";
import { useParams } from "next/navigation";

export default function ProjectIssuesPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();

  return (
    <div className="container max-w-5xl py-6">
      <IssuesList projectId={projectId} />
    </div>
  );
}
