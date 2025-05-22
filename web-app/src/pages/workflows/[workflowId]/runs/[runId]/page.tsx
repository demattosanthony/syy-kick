/** React */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

/** Hooks */
import { useRunSSE } from "@/features/workflows/features/runs/hooks";
import { useGetRunQuery } from "@/features/workflows/features/runs/api";
import { useWorkflowQuery } from "@/features/workflows/api";

/** Utils */
import {
  buildOptimisticRun,
  buildTree,
  flatten,
} from "@/features/workflows/utils";

/** Components */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon, Slash } from "lucide-react";

import { WorkflowRunGraph } from "@/features/workflows/features/runs/components/graph/workflow-run-graph";
import { WorkflowRunStatus } from "@/features/workflows/features/runs/components/workflow-run-status";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  CommentForm,
  CommentList,
} from "@/features/workflows/features/runs/features/comments/components";

/** Types */
import { User } from "@/types/user";
import {
  CustomWorkflowRun,
  StepStatus,
  TreeNode,
} from "@/features/workflows/workflows.types";

export function WorkflowRunPageDetails() {
  const { workflowId, runId } = useParams<{
    workflowId: string;
    runId: string;
  }>();

  const [runState, setRunState] = useState<CustomWorkflowRun | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);

  const { data: runQueryData, isFetching: isRunLoading } = useGetRunQuery(
    workflowId!,
    runId!
  );

  const { data: workflowQueryData, isFetching: isWorkflowLoading } =
    useWorkflowQuery(workflowId!);

  const user: User = JSON.parse(localStorage.getItem("me") ?? "{}");

  useRunSSE({
    workflowId: workflowId as string,
    workflowRunId: runId as string,
  });

  useEffect(() => {
    if (runState || !workflowQueryData || !runId) return;

    setRunState(buildOptimisticRun(workflowQueryData, runId));
  }, [workflowQueryData, runId, runState]);

  useEffect(() => {
    if (!runQueryData) return;

    const merged: CustomWorkflowRun = {
      ...runQueryData,
      definition: runQueryData.definition ?? workflowQueryData!,
    };

    setRunState(merged);
  }, [runQueryData, workflowQueryData]);

  useEffect(() => {
    if (!runState?.definition) return;

    setTreeNodes(
      buildTree(runState.definition.stepGraph, runState.snapshot.context)
    );
  }, [runState]);

  const lastOutput = useMemo(() => {
    if (!runState) return undefined;

    const flattenedSteps = workflowQueryData?.stepGraph
      ? flatten(workflowQueryData.stepGraph)
      : [];

    const lastStepId = flattenedSteps.length
      ? flattenedSteps[flattenedSteps.length - 1].id
      : undefined;

    return lastStepId
      ? runState.snapshot.context[lastStepId]?.output
      : undefined;
  }, [runState, workflowQueryData]);

  const lastRunningStep = useMemo(() => {
    if (!runState) return undefined;
    const step = Object.entries(runState.snapshot.context).find(
      ([_, data]) =>
        data.status === StepStatus.Running || data.status === StepStatus.Failed
    );

    return step
      ? {
          id: step[0],
          name: step[0],
          status: step[1].status,
          error: step[1].error,
        }
      : undefined;
  }, [runState]);

  const lastGraphStep = useMemo(() => {
    if (!workflowQueryData?.stepGraph) return null;
    return workflowQueryData.stepGraph[workflowQueryData.stepGraph.length - 1];
  }, [workflowQueryData]);

  const lastStepStatus = useMemo(() => {
    if (!lastGraphStep || !("step" in lastGraphStep)) return null;

    const id = lastGraphStep.step.id;

    const runStateStep = runState?.snapshot?.context[id];

    if (runStateStep) {
      return runStateStep.status;
    }

    return "running";
  }, [lastGraphStep, runState]);

  const workflowRunStatus = useMemo(() => {
    switch (lastStepStatus) {
      case "pending":
        return "Pending";
      case "running":
        return "Running";
      case "failed":
        return "Failed";
      case "success":
        return "Completed";
      default:
        return "Running";
    }
  }, [lastStepStatus]);

  const runStatusColor = useMemo(() => {
    switch (lastStepStatus) {
      case "pending":
        return "bg-yellow-500";
      case "running":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      case "success":
        return "bg-green-500";
      default:
        return "bg-blue-500";
    }
  }, [lastStepStatus]);

  if (isRunLoading && !runState) return <WorkflowRunDetailsSkeleton />;

  if (!runState) return null;

  return (
    <div className="w-full mx-auto p-4 space-y-6">
      <WorkflowRunDetailsBreadcrumb
        workflowId={workflowId}
        isWorkflowLoading={isWorkflowLoading}
        workflowName={workflowQueryData?.name}
        runId={runId}
      />
      <div className="flex flex-col flex-1 max-w-3xl mx-auto p-4 pt-6 w-full gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex flex-col w-full">
            <div className="flex flex-col border-l-4 border-primary pl-4 mb-2">
              <div className="flex w-full justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-4xl font-bold tracking-tight">
                    Run details
                  </h1>
                  <Badge variant="secondary">
                    #{runState?.runId?.slice(0, 8) ?? ""}
                  </Badge>
                </div>
                <Button variant="outline" asChild>
                  <Link to={`/workflows/${workflowId}/runs`}>
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to runs
                  </Link>
                </Button>
              </div>
              <h2 className="text-2xl text-primary font-bold tracking-tight">
                {runState.workflowName}
              </h2>
              <div className="flex items-center gap-6 text-muted-foreground">
                <div className="flex items-center gap-1 text-sm">
                  <p>Status:</p>
                  <div className={`w-3 h-3 rounded-full ${runStatusColor}`} />
                  <p>{workflowRunStatus}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <WorkflowRunStatus
          status={lastStepStatus as StepStatus}
          hasFailed={lastStepStatus === "failed"}
          isCompleted={lastStepStatus === "success"}
          lastOutput={lastOutput}
          lastRunningStep={lastRunningStep}
        />

        <WorkflowRunGraph
          workflowRun={runState}
          treeNodes={treeNodes}
          runState={runState}
        />

        <div className="mt-8 space-y-6">
          <h2 className="text-2xl font-bold">Comments</h2>
          <CommentForm workflowId={workflowId!} runId={runId!} />
          <CommentList
            workflowId={workflowId!}
            runId={runId!}
            currentUserId={user?.id}
          />
        </div>
      </div>
    </div>
  );
}

const WorkflowRunDetailsBreadcrumb = ({
  workflowId,
  isWorkflowLoading,
  workflowName,
  runId,
}: {
  workflowId?: string;
  isWorkflowLoading: boolean;
  workflowName?: string;
  runId?: string;
}) => {
  return (
    <Breadcrumb className="mb-8">
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link to="/workflows" className="hover:text-blue-500 hover:underline">
            Workflows
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <Slash className="w-4 h-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <Link
            to={`/workflows/${workflowId}`}
            className="hover:text-blue-500 hover:underline"
          >
            {isWorkflowLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              workflowName
            )}
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <Slash className="w-4 h-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <Link
            to={`/workflows/${workflowId}/runs`}
            className="hover:text-blue-500 hover:underline"
          >
            {isWorkflowLoading ? <Skeleton className="h-4 w-24" /> : "Runs"}
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <Slash className="w-4 h-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <span className="font-bold">Run #{runId?.slice(0, 8)}</span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const WorkflowRunDetailsSkeleton = () => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Breadcrumb className="mb-8">
        <BreadcrumbList>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-20" />
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <Slash className="w-4 h-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-24" />
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <Slash className="w-4 h-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-16" />
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <Slash className="w-4 h-4" />
          </BreadcrumbSeparator>
          <BreadcrumbItem>
            <Skeleton className="h-4 w-24" />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>

      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
};
