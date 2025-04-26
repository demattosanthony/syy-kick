"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GitBranch,
  Search,
  FileText,
  ScanSearch,
  ScanLine,
  LucideIcon,
} from "lucide-react";
import { useWorkflowsQuery } from "../api";
import { Skeleton } from "@/components/ui/skeleton";
import { Workflow } from "../workflows.types";
interface WorkflowsListProps {
  initalData?: Workflow[];
  projectId?: string;
}

const workflowIcons: { [key: string]: LucideIcon } = {
  "Smart Page Finder": Search,
  "Targeted PDF Extraction": FileText,
  "Project Detective": ScanSearch,
  "AI-Powered OCR Scan": ScanLine,
  default: GitBranch,
};

const getWorkflowIcon = (title: string): LucideIcon => {
  return workflowIcons[title] || workflowIcons.default;
};

export default function WorkflowsList(props: WorkflowsListProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";

  const { data: workflows, isLoading } = useWorkflowsQuery(props.initalData);

  const filteredWorkflows = search
    ? workflows?.filter((workflow) =>
        workflow.title.toLowerCase().includes(search.toLowerCase())
      )
    : workflows;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {isLoading &&
        !filteredWorkflows &&
        Array.from({ length: 4 }).map((_, i) => <WorkflowSkeleton key={i} />)}

      {!isLoading && filteredWorkflows?.length === 0 && (
        <div className="col-span-1 md:col-span-2 flex items-center justify-center h-full py-10">
          <p className="text-muted-foreground">No workflows found</p>
        </div>
      )}

      {filteredWorkflows?.map((workflow, i) => (
        <WorkflowItem key={i} workflow={workflow} projectId={props.projectId} />
      ))}
    </div>
  );
}

function WorkflowItem({
  workflow,
  projectId,
}: {
  workflow: Workflow;
  projectId?: string;
}) {
  const Icon = getWorkflowIcon(workflow.title);

  return (
    <Link
      href={
        projectId
          ? `/projects/${projectId}/workflows/${workflow.id}`
          : `/workflows/${workflow.id}`
      }
      prefetch={false}
      className="block p-6 rounded-lg bg-card hover:bg-accent border transition-colors group"
    >
      <div className="flex flex-col gap-4">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-card-foreground mb-1">
            {workflow.title}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {workflow.description}
          </p>
        </div>
      </div>
    </Link>
  );
}

function WorkflowSkeleton() {
  return (
    <div className="p-6 rounded-lg bg-card border">
      <div className="flex flex-col gap-4">
        <Skeleton className="w-10 h-10 rounded-md" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
