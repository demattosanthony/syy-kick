"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Workflow } from "@/types/workflow-types";
import { getRelativeTimeString } from "@/lib/utils";
import { GitBranch, GitBranchPlus, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteWorkflowMutation, useWorkflowsQuery } from "../api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkflowsList() {
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: workflows, isLoading } = useWorkflowsQuery();

  // Filter workflows by search term if provided
  const filteredWorkflows = search
    ? workflows?.filter((workflow) =>
        workflow.name.toLowerCase().includes(search.toLowerCase())
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteWorkflow = useDeleteWorkflowMutation();

  const handleDelete = () => {
    deleteWorkflow.mutate(workflow.id);
  };

  return (
    <div className="mb-2 hover:bg-accent p-4 rounded-lg transition-colors max-w-full group relative">
      <Link href={`/workflows/${workflow.id}`} prefetch className="block">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-muted-foreground relative">
            <GitBranch className="w-6 h-6 absolute text-purple-400 transition-opacity duration-200 group-hover:opacity-0" />
            <GitBranchPlus className="w-6 h-6 text-purple-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xl font-medium">{workflow.name}</p>

            <p className="text-xs text-muted-foreground">
              Updated {getRelativeTimeString(workflow.updatedAt)}
            </p>
          </div>
        </div>
      </Link>

      {/* Ellipsis menu - positioned absolutely to not interfere with the link */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workflow "{workflow.name}". This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
