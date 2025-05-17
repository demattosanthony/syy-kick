import { Link, useParams } from "react-router";
import { useWorkflowQuery } from "@/features/workflows/api";
import { Slash } from "lucide-react";
import { useRunSSE } from "@/features/workflows/features/runs/hooks";
import { useState, useEffect, useMemo, useRef } from "react";
import { CustomWorkflowRun, StepStatus, TreeNode } from "@/features/workflows/workflows.types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkflowRunGraph } from "@/features/workflows/features/runs/components/graph/workflow-run-graph";
import { WorkflowRunTimeline } from "@/features/workflows/features/runs/components/timeline/workflow-run-timeline";
import { WorkflowRunDetails } from "@/features/workflows/features/runs/components/details/workflow-run-details";
import { buildOptimisticRun, buildTree, flatten } from "@/features/workflows/utils";
import { useGetRunQuery } from "@/features/workflows/features/runs/api";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowRunStatus } from "@/features/workflows/features/runs/components/workflow-run-status";
import { WorkflowRunInput } from "@/features/workflows/features/runs/components/workflow-run-input";

export function WorkflowRunPageDetails() {
  const { workflowId, runId } = useParams<{ workflowId: string; runId: string }>();

  const [runState, setRunState] = useState<CustomWorkflowRun | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [now, setNow] = useState(Date.now());
  const startMsRef = useRef<number>(0);

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


    if (!startMsRef.current) {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startDate = new Date(runState.createdAt).toLocaleString('en-US', { timeZone: userTimeZone });
      const startDateObj = new Date(startDate);
      startMsRef.current = startDateObj.getTime();
    }

    setTreeNodes(
      buildTree(
        runState.definition.stepGraph,
        runState.snapshot.context,
      ),
    );

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

  const isCompleted = useMemo(
    () => totalSteps > 0 && completedSteps === totalSteps,
    [totalSteps, completedSteps],
  );
  const hasFailed = useMemo(() => failedSteps > 0, [failedSteps])
  const status = useMemo(() => hasFailed ? "failed" : isCompleted ? "success" : "in-progress", [hasFailed, isCompleted])

  const duration = useMemo(() => {
    if (!runState) return "0s";

    const startMs = startMsRef.current!;
    const endMs = (isCompleted || hasFailed)
      ? new Date(runState.updatedAt).getTime()
      : now;

    const diffMs = Math.max(endMs - startMs, 0);
    const diffSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;

    return `${mins}m ${secs}s`;
  }, [now, isCompleted, hasFailed, runState?.updatedAt]);


  const startTime = useMemo(() => {
    if (!runState) return null
    return new Date(runState.createdAt).toLocaleTimeString()
  }, [runState])

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
  }, [runState, workflowQueryData])

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
        lastOutput={lastOutput}
      />

      <WorkflowRunInput runState={runState} />

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
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