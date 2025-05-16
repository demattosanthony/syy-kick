"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { type CustomWorkflowRun, type TreeNode } from "@/features/workflows/workflows.types"
import { SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { StepDetailsDialog } from "@/features/workflows/features/runs/components"
import { StepEntry } from "@/features/workflows/features/runs/components/graph"

export function WorkflowRunGraph({
  workflowRun,
  treeNodes,
}: { workflowRun: CustomWorkflowRun; treeNodes: TreeNode[] }) {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

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
            setSelectedNode={setSelectedNode}
          />
        </div>

        {selectedNode && <StepDetailsDialog node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </CardContent>
    </Card>
  )
}

function StepGraph({
  stepGraph,
  treeNodes,
  setSelectedNode,
}: {
  stepGraph: SerializedStepFlowEntry[]
  treeNodes: TreeNode[]
  setSelectedNode: (node: TreeNode) => void
}) {
  return (
    <div className="flex flex-col items-center space-y-8">
      {stepGraph.map((entry, index) => (
        <div key={index} className="w-full">
          <StepEntry
            entry={entry}
            treeNodes={treeNodes}
            setSelectedNode={setSelectedNode}
          />
          {index < stepGraph.length - 1 && (
            <div className="flex justify-center my-2">
              <div className="h-8 w-0.5 bg-muted"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}