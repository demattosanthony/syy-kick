"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TreeNode } from "@/features/workflows/workflows.types"
import { StepDetailsDialog } from "@/features/workflows/features/runs/components"
import { TimelineStep } from "@/features/workflows/features/runs/components/timeline"

export function WorkflowRunTimeline({
  treeNodes,
}: { treeNodes: TreeNode[] }) {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  // Sort tree nodes by startedAt time
  const sortedNodes = [...treeNodes].sort((a, b) => {
    if (!a.startedAt) return 1
    if (!b.startedAt) return -1
    return a.startedAt - b.startedAt
  })

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          {sortedNodes.map((node, index) => (
            <TimelineStep
              stepNumber={index + 1}
              key={node.path}
              node={node}
              isLast={index === sortedNodes.length - 1}
              onShowDetails={() => setSelectedNode(node)}
            />
          ))}
        </div>

        {selectedNode && <StepDetailsDialog node={selectedNode} />}
      </CardContent>
    </Card>
  )
}