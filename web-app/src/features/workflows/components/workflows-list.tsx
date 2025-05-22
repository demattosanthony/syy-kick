import { Link } from "react-router";
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
import { useMemo } from "react";
import { EnhancedWorkflowResponse } from "../workflows.types";

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

export default function WorkflowsList() {
  // const [searchParams] = useSearchParams();
  // const search = searchParams.get("search") || "";

  const { data: workflows, isLoading } = useWorkflowsQuery();

  const filteredWorkflows = workflows;

  const workflowsListIsEmpty = useMemo(() => {
    return Object.keys(filteredWorkflows || {}).length === 0;
  }, [filteredWorkflows]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {isLoading &&
        !filteredWorkflows &&
        Array.from({ length: 4 }).map((_, i) => <WorkflowSkeleton key={i} />)}

      {!isLoading && workflowsListIsEmpty && (
        <div className="col-span-1 md:col-span-2 flex items-center justify-center h-full py-10">
          <p className="text-muted-foreground">No workflows found</p>
        </div>
      )}

      {Object.entries(filteredWorkflows || {}).map(([id, workflow], i) => (
        <WorkflowItem key={i} id={id} workflow={workflow} />
      ))}
    </div>
  );
}

function WorkflowItem({
  id,
  workflow,
  projectId,
}: {
  id: string;
  workflow: EnhancedWorkflowResponse;
  projectId?: string;
}) {
  const Icon = getWorkflowIcon(workflow.name);

  return (
    <Link
      to={
        projectId
          ? `/projects/${projectId}/workflows/${id}`
          : `/workflows/${id}`
      }
      className="block p-6 rounded-lg bg-card hover:bg-accent border transition-colors group"
    >
      <div className="flex flex-col gap-4">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-card-foreground mb-1">
            {workflow.name}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {workflow.description}
          </p>

          {/* Tags */}
          {workflow.tags && workflow.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {workflow.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: tag.hexBgColor,
                    color: tag.hexTextColor,
                    borderColor: tag.hexBgColor,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
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
          <Skeleton className="h-4 w-5/6 mb-3" />
          {/* Tags skeleton */}
          <div className="flex gap-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
