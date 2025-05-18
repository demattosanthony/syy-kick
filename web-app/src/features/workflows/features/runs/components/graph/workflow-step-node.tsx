import { StepStatus, TreeNode } from "@/features/workflows/workflows.types"
import { StepStatusBadge } from "@/features/workflows/features/runs/components"
import { WorkflowRunStepStatusIcon } from "@/features/workflows/features/runs/components"
import { Badge } from "@/components/ui/badge"
import { formatStepName, renderStepOutput } from "@/features/workflows/utils"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

export function StepNode({
    stepId,
    stepNumber,
    description,
    node,
    isLoop,
    isForeach,
}: {
    stepId: string
    stepNumber: number
    description: string
    node?: TreeNode
    isLoop?: boolean
    isForeach?: boolean
}) {
    const status = node?.status || StepStatus.Pending
    const isRunning = status === StepStatus.Running

    return (
        <Accordion
            type="single"
            collapsible
            defaultValue={isRunning ? "step" : undefined}
            className={`
                w-full rounded-md border
                hover:shadow-md transition-shadow
            `}
        >
            <AccordionItem value="step" className="border-none">
                <AccordionTrigger
                    className="px-4 py-4 hover:no-underline"
                    onClick={(e) => {
                        e.stopPropagation()
                        // onClick()
                    }}
                >
                    <div className="flex justify-between items-center w-full">
                        <h3 className="text-sm font-medium">{`Step ${stepNumber}: ${formatStepName(stepId)}`}</h3>
                        <StepStatusBadge status={status} />
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>

                    {node?.output && (
                        <div className="mt-3 pt-3 border-t border-dashed border-muted">
                            <p className="text-xs font-medium mb-2">Output:</p>
                            {renderStepOutput(node.output)}
                        </div>
                    )}


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
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}