import { SerializedStepFlowEntry, SerializedStep } from "@mastra/core/workflows/vNext"
import { TreeNode } from "@/features/workflows/workflows.types"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { StepNode } from "@/features/workflows/features/runs/components/graph"

type LoopEntry = SerializedStepFlowEntry & {
    type: "loop"
    step: SerializedStep
    loopType: "dowhile" | "dountil"
}

export function LoopNode({
    stepNumber,
    entry,
    treeNodes,
    setSelectedNode,
}: {
    stepNumber: number
    entry: LoopEntry
    treeNodes: TreeNode[]
    setSelectedNode: (node: TreeNode) => void
}) {
    const node = treeNodes.find((node) => node.stepId === entry.step.id)
    return (
        <div className="w-full">
            <div className="flex justify-center mb-4">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {entry.loopType === "dowhile" ? "Do While Loop" : "Do Until Loop"}
                </Badge>
            </div>
            <div className="border border-dashed border-muted rounded-md p-4">
                <StepNode
                    stepNumber={stepNumber}
                    stepId={entry.step.id}
                    description={entry.step.description || ""}
                    node={node}
                    isLoop={true}
                    onClick={() => node && setSelectedNode(node)}
                />
            </div>
        </div>
    )
}