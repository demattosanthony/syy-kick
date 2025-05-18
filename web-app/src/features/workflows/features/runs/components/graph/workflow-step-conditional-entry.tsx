import { SerializedStepFlowEntry } from "@mastra/core/workflows/vNext"
import { TreeNode, StepStatus } from "@/features/workflows/workflows.types"
import { Badge } from "@/components/ui/badge"
import { GitBranch, GitMerge } from "lucide-react"
import { StepEntry } from "@/features/workflows/features/runs/components/graph"

type ConditionalEntry = SerializedStepFlowEntry & {
    type: "conditional"
    steps: SerializedStepFlowEntry[]
    serializedConditions: {
        id: string
        fn: string
    }[]
}

export function ConditionalNode({
    stepNumber,
    entry,
    treeNodes,
}: {
    stepNumber: number
    entry: ConditionalEntry
    treeNodes: TreeNode[]
}) {
    const getConditionStatus = (stepId: string): StepStatus => {
        const node = treeNodes.find(n => n.stepId === stepId)
        if (!node) return StepStatus.Pending
        
        // If the step has a success status, it has been executed
        if (node.status === StepStatus.Success) return StepStatus.Success
        
        // If the step is pending but another conditional step has succeeded,
        // then this step has been skipped
        const hasSuccessfulCondition = entry.steps.some(step => {
            if (step.type !== "step") return false
            const stepNode = treeNodes.find(n => n.stepId === step.step.id)
            return stepNode?.status === StepStatus.Success
        })
        
        return hasSuccessfulCondition ? StepStatus.Skipped : StepStatus.Pending
    }

    return (
        <div className="w-full">
            <div className="flex justify-center mb-4">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <GitBranch className="h-3 w-3 mr-1" />
                    Conditional Branch
                </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entry.steps.map((step: SerializedStepFlowEntry, idx: number) => {
                    if (step.type !== "step") return null
                    const conditionStatus = getConditionStatus(step.step.id)
                    
                    return (
                        <div key={idx} className="border border-dashed border-muted rounded-md p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-muted-foreground">Condition {idx + 1}</div>
                                <Badge variant="outline" className={`
                                    ${conditionStatus === StepStatus.Success ? 'bg-green-50 text-green-700 border-green-200' : 
                                      conditionStatus === StepStatus.Skipped ? 'bg-gray-50 text-gray-700 border-gray-200' : 
                                      'bg-yellow-50 text-yellow-700 border-yellow-200'}
                                `}>
                                    {conditionStatus === StepStatus.Success ? 'Executed' : 
                                     conditionStatus === StepStatus.Skipped ? 'Skipped' : 
                                     'Pending'}
                                </Badge>
                            </div>
                            <StepEntry stepNumber={stepNumber} entry={step} treeNodes={treeNodes} />
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-center mt-4">
                <GitMerge className="h-5 w-5 text-muted-foreground" />
            </div>
        </div>
    )
}