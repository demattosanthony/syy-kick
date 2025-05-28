import {
  SerializedStepFlowEntry,
  SerializedStep,
} from "@mastra/core/workflows";
import { TreeNode } from "@/features/workflows/workflows.types";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { StepNode } from "@/features/workflows/features/runs/components/graph";

type ForEachEntry = SerializedStepFlowEntry & {
  type: "foreach";
  step: SerializedStep;
  opts: {
    concurrency: number;
  };
};

export function ForEachNode({
  stepNumber,
  entry,
  treeNodes,
}: {
  stepNumber: number;
  entry: ForEachEntry;
  treeNodes: TreeNode[];
}) {
  const node = treeNodes.find((node) => node.stepId === entry.step.id);
  return (
    <div className="w-full">
      <div className="flex justify-center mb-4">
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          For Each (Concurrency: {entry.opts.concurrency})
        </Badge>
      </div>
      <div className="border border-dashed border-muted rounded-md p-4">
        <StepNode
          stepNumber={stepNumber}
          stepId={entry.step.id}
          description={entry.step.description || ""}
          node={node}
          isForeach={true}
        />
      </div>
    </div>
  );
}
