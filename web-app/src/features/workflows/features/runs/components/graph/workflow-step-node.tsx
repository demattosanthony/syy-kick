import { StepStatus, TreeNode } from "@/features/workflows/workflows.types"
import { StepStatusBadge } from "@/features/workflows/features/runs/components"
import { Button } from "@/components/ui/button"
import { WorkflowRunStepStatusIcon } from "@/features/workflows/features/runs/components"
import { Badge } from "@/components/ui/badge"
import { formatStepName } from "@/features/workflows/utils"

export function StepNode({
    stepId,
    stepNumber,
    description,
    node,
    isLoop,
    isForeach,
    onClick,
}: {
    stepId: string
    stepNumber: number
    description: string
    node?: TreeNode
    isLoop?: boolean
    isForeach?: boolean
    onClick: () => void
}) {
    const status = node?.status || StepStatus.Pending

    return (
        <div
            className={`
          w-full max-w-md mx-auto p-4 rounded-md border 
          ${status === StepStatus.Success
                    ? "border-green-200 bg-green-50"
                    : status === StepStatus.Failed
                        ? "border-red-200 bg-red-50"
                        : status === StepStatus.Running
                            ? "border-blue-200 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                }
          hover:shadow-md transition-shadow cursor-pointer
        `}
            onClick={onClick}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-medium">{`Step ${stepNumber}: ${formatStepName(stepId)}`}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>

                    {(isLoop || isForeach) && (
                        <div className="mt-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                Show Details
                            </Button>
                        </div>
                    )}
                </div>
                <StepStatusBadge status={status} />
            </div>

            {node?.children && node.children.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-muted">
                    <p className="text-xs text-muted-foreground mb-2">
                        {isForeach
                            ? `${node.children.length} iterations`
                            : isLoop
                                ? `${node.children.length} loops`
                                : `${node.children.length} sub-steps`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {node.children.slice(0, 5).map((child, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                                <WorkflowRunStepStatusIcon status={child.status} />
                                {isForeach ? `Item ${idx + 1}` : `Loop ${idx + 1}`}
                            </Badge>
                        ))}
                        {node.children.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                                +{node.children.length - 5} more
                            </Badge>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}