"use client"

import { Card, CardContent } from "@/components/ui/card"
import { type CustomWorkflowRun, type TreeNode } from "@/features/workflows/workflows.types"
import { SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { StepEntry } from "@/features/workflows/features/runs/components/graph"

export function WorkflowRunGraph({
  workflowRun,
  treeNodes,
}: { workflowRun: CustomWorkflowRun; treeNodes: TreeNode[] }) {

  if (!workflowRun.definition) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center p-6">
            <p>No workflow definition available to render graph.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 overflow-auto">
        <div className="min-w-[800px]">
          <StepGraph
            stepGraph={workflowRun.definition.stepGraph}
            treeNodes={treeNodes}
          />
        </div>

      </CardContent>
    </Card>
  )
}

function StepGraph({
  stepGraph,
  treeNodes,
}: {
  stepGraph: SerializedStepFlowEntry[]
  treeNodes: TreeNode[]
}) {
  return (
    <div className="flex flex-col items-center space-y-4">
      {stepGraph.map((entry, index) => (
        <div key={index} className="w-full">
          <StepEntry
            stepNumber={index + 1}
            entry={entry}
            treeNodes={treeNodes}
          />
          {index < stepGraph.length - 1 && (
            <div className="flex justify-center my-2">
              <div className="h-4 w-0.5 bg-muted"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}