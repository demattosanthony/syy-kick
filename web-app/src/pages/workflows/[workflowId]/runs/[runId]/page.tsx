import { Link, useParams } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api";
import { Slash } from "lucide-react";
import { useRunSSE } from "@/features/workflows/features/runs/hooks";
import { useState, useEffect, useMemo } from "react";
import { CustomWorkflowRun, StepStatus, TreeNode } from "@/features/workflows/workflows.types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkflowRunGraph } from "@/features/workflows/features/runs/components/graph/workflow-run-graph";
import { WorkflowRunTimeline } from "@/features/workflows/features/runs/components/timeline/workflow-run-timeline";
import { WorkflowRunDetails } from "@/features/workflows/features/runs/components/details/workflow-run-details";
import { Card, CardContent } from "@/components/ui/card";
import { buildOptimisticRun, buildTree } from "@/features/workflows/utils";
import { useGetRunQuery } from "@/features/workflows/features/runs/api";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowRunStatus } from "@/features/workflows/features/runs/components/workflow-run-status";
import { WorkflowRunInput } from "@/features/workflows/features/runs/components/workflow-run-input";

export function WorkflowRunPageDetails() {g
  const { workflowId, runId } = useParams<{ workflowId: string; runId: string }>();

  const [runState, setRunState] = useState<CustomWorkflowRun | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [now, setNow] = useState(Date.now());

  const {
    data: runQueryData,
    isFetching: isRunLoading,
  } = useGetRunQuery(
    workflowId!,
    runId!
  );

  const {
    data: workflowQueryData,
    isFetching: isWorkflowLoading,
  } = useWorkflowQuery(workflowId!);


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
      definition: runQueryData.definition
        ?? workflowQueryData!,
    };

    setRunState(merged);
  }, [runQueryData, workflowQueryData]);

  useEffect(() => {
    if (!runState?.definition) return;

    setTreeNodes(
      buildTree(
        runState.definition.stepGraph,
        runState.snapshot.context,
      ),
    );
  }, [runState]);


  useEffect(() => {
    if (!runState) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [runState]);

  // Process the workflow run data
  const steps = useMemo(() => {
    return Object.entries(runState?.snapshot.context ?? {})
    .filter(([key]) => key !== "input")
    .map(([id, data]) => ({
      id,
      status: data.status,
      output: data.output,
      error: data.error,
      }))
  }, [runState])

  const totalSteps = useMemo(() => workflowQueryData?.stepGraph.length ?? 0, [workflowQueryData])
  const completedSteps = useMemo(() => steps.filter((step) => step.status === StepStatus.Success).length, [steps])
  const failedSteps = useMemo(() => steps.filter((step) => step.status === StepStatus.Failed).length, [steps])

  const isCompleted = useMemo(() => totalSteps > 0 && completedSteps === totalSteps, [totalSteps, completedSteps])
  const hasFailed = useMemo(() => failedSteps > 0, [failedSteps])
  const status = useMemo(() => hasFailed ? "failed" : isCompleted ? "success" : "in-progress", [hasFailed, isCompleted])

  const duration = useMemo(() => {
    if (!runState) return null;
    const start = new Date(runState.createdAt).getTime();
    const end = runState.updatedAt
      ? new Date(runState.updatedAt).getTime()
      : now;
    const diffMs = Math.max(end - start, 0);
    const diffSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
  }, [runState, now]);

  const startTime = useMemo(() => {
    if (!runState) return null
    return new Date(runState.createdAt).toLocaleTimeString()
  }, [runState])

  if (isRunLoading && !runState) return <WorkflowRunDetailsSkeleton />

  if (!runState) return null

  return (
    <div className="container mx-auto p-4 space-y-6">
      <WorkflowRunDetailsBreadcrumb
        workflowId={workflowId}
        isWorkflowLoading={isWorkflowLoading}
        workflowName={workflowQueryData?.name}
        runId={runId}
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{runState.workflowName}</h1>
          <p className="text-muted-foreground">
            Run ID: {runState.runId.substring(0, 8)}... • {new Date(runState.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <WorkflowRunStatus
        completedSteps={completedSteps}
        totalSteps={totalSteps}
        status={status}
        hasFailed={hasFailed}
        isCompleted={isCompleted}
        duration={duration ?? "0s"}
        startTime={startTime ?? "0s"}
      />

      <WorkflowRunInput runState={runState} />

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        {/* Workflow Run Graph */}
        <TabsContent value="graph" className="mt-4">
          <WorkflowRunGraph workflowRun={runState} treeNodes={treeNodes} />
        </TabsContent>

        {/* Workflow Run Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <WorkflowRunTimeline treeNodes={treeNodes} />
        </TabsContent>

        {/* Workflow Run Details */}
        <TabsContent value="details" className="mt-4">
          <WorkflowRunDetails treeNodes={treeNodes} />
        </TabsContent>

        {/* Workflow Run JSON */}
        <TabsContent value="json" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[500px] text-sm">
                {JSON.stringify(runState, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


const WorkflowRunDetailsBreadcrumb = ({
  workflowId,
  isWorkflowLoading,
  workflowName,
  runId,
}: {
  workflowId?: string,
  isWorkflowLoading: boolean,
  workflowName?: string,
  runId?: string
}) => {
  return (
    <Breadcrumb className="mb-8">
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link
            to="/workflows"
            className="hover:text-blue-500 hover:underline"
          >
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
            {isWorkflowLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              'Runs'
            )}
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
  )
}

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

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="mt-4">
          <Skeleton className="h-[500px] w-full" />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="json" className="mt-4">
          <Skeleton className="h-[500px] w-full" />
        </TabsContent>
      </Tabs>
    </div>
  )
}