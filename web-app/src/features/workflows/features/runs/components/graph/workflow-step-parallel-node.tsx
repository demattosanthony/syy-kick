import { SerializedStepFlowEntry } from "@mastra/core/workflows";
import { TreeNode } from "@/features/workflows/workflows.types";
import { Badge } from "@/components/ui/badge";
import { GitBranch, GitMerge } from "lucide-react";
import { StepEntry } from "@/features/workflows/features/runs/components/graph";

type ParallelEntry = SerializedStepFlowEntry & {
  type: "parallel";
  steps: SerializedStepFlowEntry[];
};

export function ParallelNode({
  stepNumber,
  entry,
  treeNodes,
}: {
  stepNumber: number;
  entry: ParallelEntry;
  treeNodes: TreeNode[];
}) {
  return (
    <div className="w-full">
      <div className="flex justify-center mb-4">
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <GitBranch className="h-3 w-3 mr-1" />
          Parallel Execution
        </Badge>
      </div>
      <div
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${entry.steps.length} gap-2`}
      >
        {entry.steps.map((step: SerializedStepFlowEntry, idx: number) => (
          <div
            key={idx}
            className="border border-dashed border-muted rounded-md p-4"
          >
            <StepEntry
              stepNumber={stepNumber}
              entry={step}
              treeNodes={treeNodes}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4">
        <GitMerge className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}
