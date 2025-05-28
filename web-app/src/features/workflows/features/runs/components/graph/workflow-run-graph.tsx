"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  type CustomWorkflowRun,
  type TreeNode,
} from "@/features/workflows/workflows.types";
import { SerializedStepFlowEntry } from "@mastra/core/workflows";
import { StepEntry } from "@/features/workflows/features/runs/components/graph";
import { WorkflowRunInput } from "../workflow-run-input";

export function WorkflowRunGraph({
  workflowRun,
  treeNodes,
  runState,
}: {
  workflowRun: CustomWorkflowRun;
  treeNodes: TreeNode[];
  runState: CustomWorkflowRun;
}) {
  if (!workflowRun.definition) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center p-6">
            <p>No workflow definition available to render graph.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <StepGraph
      stepGraph={workflowRun.definition.stepGraph}
      treeNodes={treeNodes}
      runState={runState}
    />
  );
}

function StepGraph({
  stepGraph,
  treeNodes,
  runState,
}: {
  stepGraph: SerializedStepFlowEntry[];
  treeNodes: TreeNode[];
  runState: CustomWorkflowRun;
}) {
  return (
    <div className="flex flex-col items-center w-full">
      <WorkflowRunInput runState={runState} />
      <div className="flex justify-center">
        <div className="h-8 w-px bg-gray-400"></div>
      </div>
      {stepGraph.map((entry, index) => (
        <div key={index} className="w-full">
          <StepEntry
            stepNumber={index + 1}
            entry={entry}
            treeNodes={treeNodes}
          />
          {index < stepGraph.length - 1 && (
            <div className="flex justify-center">
              <div className="h-8 w-px bg-gray-400"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
