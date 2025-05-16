import { SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { TreeNode } from "@/features/workflows/workflows.types"
import { Badge } from "@/components/ui/badge"
import { GitBranch, GitMerge } from "lucide-react"
import { StepEntry } from "@/features/workflows/features/runs/components/graph"

type ConditionalEntry = SerializedStepFlowEntry & {
    type: "conditional"
    steps: SerializedStepFlowEntry[]
}

export function ConditionalNode({
    entry,
    treeNodes,
    setSelectedNode,
}: {
    entry: ConditionalEntry
    treeNodes: TreeNode[]
    setSelectedNode: (node: TreeNode) => void
}) {
    return (
        <div className="w-full">
            <div className="flex justify-center mb-4">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <GitBranch className="h-3 w-3 mr-1" />
                    Conditional Branch
                </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entry.steps.map((step: SerializedStepFlowEntry, idx: number) => (
                    <div key={idx} className="border border-dashed border-muted rounded-md p-4">
                        <div className="text-xs text-center mb-2 text-muted-foreground">Condition {idx + 1}</div>
                        <StepEntry entry={step} treeNodes={treeNodes} setSelectedNode={setSelectedNode} />
                    </div>
                ))}
            </div>
            <div className="flex justify-center mt-4">
                <GitMerge className="h-5 w-5 text-muted-foreground" />
            </div>
        </div>
    )
}