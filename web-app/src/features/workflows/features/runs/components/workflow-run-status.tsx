import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Clock, SkipForward } from "lucide-react";
import {
  StepOutputValue,
  StepStatus,
} from "@/features/workflows/workflows.types";
import { formatStepName, renderStepOutput } from "@/features/workflows/utils";
import { useMemo } from "react";

type WorkflowRunStatusProps = {
  status: StepStatus;
  hasFailed: boolean;
  isCompleted: boolean;
  lastOutput: StepOutputValue | undefined;
  lastRunningStep?: {
    id: string;
    name: string;
    status: string;
    error?: string;
  };
};

export function WorkflowRunStatus({
  status,
  hasFailed,
  isCompleted,
  lastOutput,
  lastRunningStep,
}: WorkflowRunStatusProps) {
  const statusTitle = useMemo(() => {
    if (hasFailed) {
      return "Failed";
    }

    if (isCompleted) {
      return "Completed";
    }

    if (lastRunningStep) {
      return `In Progress: ${formatStepName(lastRunningStep.name)}`;
    }

    return "In Progress";
  }, [hasFailed, isCompleted, lastRunningStep]);

  return (
    <div className="space-y-6 w-full">
      {!isCompleted && !hasFailed ? (
        <StatusCard
          title="Current Status"
          value={statusTitle}
          status={status}
          description={
            hasFailed
              ? "One or more steps failed"
              : isCompleted
              ? "All steps completed successfully"
              : "Workflow is running"
          }
        />
      ) : hasFailed ? (
        <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-lg font-semibold text-red-700">Run Failed</h2>
          </div>
          {lastRunningStep ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">
                Step "{formatStepName(lastRunningStep.name)}" has failed
              </p>
              {lastRunningStep.error && (
                <div className="bg-white rounded-lg p-4 border border-red-100">
                  <p className="text-sm font-medium text-red-700 mb-2">
                    Error details:
                  </p>
                  <p className="text-sm text-red-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {JSON.stringify(lastRunningStep.error, null, 2)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-600">
              One or more steps in the workflow have failed. Please check the
              timeline for more details.
            </p>
          )}
        </Card>
      ) : (
        lastOutput && (
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-card dark:border-border dark:text-white dark:bg-gradient-to-br dark:from-card dark:to-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-green-700">Result</h2>
            </div>
            <div className="bg-white rounded-lg p-4 border border-green-100 dark:bg-card dark:border-none dark:text-white dark:p-0">
              {renderStepOutput(lastOutput)}
            </div>
          </Card>
        )
      )}
    </div>
  );
}

function StatusCard({
  title,
  value,
  status,
  description,
}: {
  title: string;
  value: string;
  status: StepStatus;
  description: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: StepStatus }) {
  switch (status) {
    case "success":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <Check className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <X className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "waiting":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200"
        >
          <Clock className="h-3 w-3 mr-1" />
          Waiting
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-700 border-gray-200"
        >
          <SkipForward className="h-3 w-3 mr-1" />
          Skipped
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
