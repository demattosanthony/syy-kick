"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Workflow } from "@/types/workflow-types";
import { GitBranch, GitBranchPlus } from "lucide-react";
import { useWorkflowsQuery } from "../api";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowsList() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: workflows, isLoading } = useWorkflowsQuery();

  // Filter workflows by search term if provided
  const filteredWorkflows = search
    ? workflows?.filter((workflow) =>
        workflow.title.toLowerCase().includes(search.toLowerCase())
      )
    : workflows;

  return (
    <ScrollArea className="h-[calc(100vh-175px)] px-2">
      {filteredWorkflows?.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">No workflows found</p>
        </div>
      ) : (
        filteredWorkflows?.map((workflow, i) => (
          <WorkflowItem key={i} workflow={workflow} />
        ))
      )}

      <div ref={scrollRef} className="h-10">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <WorkflowSkeleton key={i} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function WorkflowItem({ workflow }: { workflow: Workflow }) {
  return (
    <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full group relative">
      <Link href={`/workflows/${workflow.id}`} prefetch className="block">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-muted-foreground relative">
            <GitBranch className="w-6 h-6 absolute text-purple-400 transition-opacity duration-200 group-hover:opacity-0" />
            <GitBranchPlus className="w-6 h-6 text-purple-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xl font-medium">{workflow.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {workflow.description}
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

function WorkflowSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}
