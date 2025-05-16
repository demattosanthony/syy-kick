import { TreeNode } from "@/features/workflows/workflows.types"
import { SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { StepNode } from "./workflow-step-node"
import { ParallelNode } from "./workflow-step-parallel-node"
import { ConditionalNode } from "@/features/workflows/features/runs/components/graph"
import { LoopNode } from "@/features/workflows/features/runs/components/graph"
import { ForEachNode } from "@/features/workflows/features/runs/components/graph"

export function StepEntry({
    entry,
    treeNodes,
    setSelectedNode,
}: {
    entry: SerializedStepFlowEntry
    treeNodes: TreeNode[]
    setSelectedNode: (node: TreeNode) => void
}) {
    const getNodeForStep = (stepId: string): TreeNode | undefined => {
        return treeNodes.find((node) => node.stepId === stepId)
    }

    switch (entry.type) {
        case "step": {
            const node = getNodeForStep(entry.step.id)
            return (
                <StepNode
                    stepId={entry.step.id}
                    description={entry.step.description || ""}
                    node={node}
                    onClick={() => node && setSelectedNode(node)}
                />
            )
        }
        case "parallel":
            return <ParallelNode entry={entry} treeNodes={treeNodes} setSelectedNode={setSelectedNode} />
        case "conditional":
            return <ConditionalNode entry={entry} treeNodes={treeNodes} setSelectedNode={setSelectedNode} />
        case "loop":
            return <LoopNode entry={entry} treeNodes={treeNodes} setSelectedNode={setSelectedNode} />
        case "foreach":
            return <ForEachNode entry={entry} treeNodes={treeNodes} setSelectedNode={setSelectedNode} />
    }
}