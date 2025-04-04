"use client";

import { IssuesList } from "@/features/projects/issues/components/issues-list";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import useDebounce from "@/hooks/use-debounce";

export default function ProjectIssuesPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Input
          placeholder="Search issues..."
          className="max-w-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Link href={`/projects/${projectId}/issues/new`}>
          <Button>Create Issue</Button>
        </Link>
      </div>
      <IssuesList projectId={projectId} searchTerm={debouncedSearchTerm} />
    </div>
  );
}
