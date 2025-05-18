"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TreeNode } from "@/features/workflows/workflows.types"
import { StepDetailRow } from "@/features/workflows/features/runs/components/details"
import { StepDetailsDialog } from "@/features/workflows/features/runs/components"

export function WorkflowRunDetails({
  treeNodes,
}: { treeNodes: TreeNode[] }) {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)

  // Flatten tree nodes to include all children
  const flattenNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.reduce((acc, node) => {
      acc.push(node)
      if (node.children && node.children.length > 0) {
        acc.push(...flattenNodes(node.children))
      }
      return acc
    }, [] as TreeNode[])
  }

  const allNodes = flattenNodes(treeNodes)

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Step ID</TableHead>
              <TableHead>Path</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allNodes.map((node, index) => (
              <StepDetailRow key={node.path} node={node} onShowDetails={() => setSelectedNode(node)} />
            ))}
          </TableBody>
        </Table>

        {selectedNode && <StepDetailsDialog node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </CardContent>
    </Card>
  )
}


