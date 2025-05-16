import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { StepStatus, type TreeNode } from "@/features/workflows/workflows.types"
import { renderStepOutput } from "@/features/workflows/utils"
import { WorkflowRunStepStatusIcon } from "@/features/workflows/features/runs/components"
import { StepStatusBadge } from "@/features/workflows/features/runs/components"
import { RefreshCw } from "lucide-react"

export function TimelineStep({ node, isLast, onShowDetails }: { node: TreeNode; isLast: boolean; onShowDetails: () => void }) {
    const [isOpen, setIsOpen] = useState(false)

    const getStepDescription = (node: TreeNode) => {
        if (node.description) return node.description

        switch (node.type) {
            case "foreach":
                return `Process each item with concurrency ${node.foreachConcurrency || 1}`
            case "loop":
                return `Repeat until condition is met (${node.loopType === "dowhile" ? "Do While" : "Do Until"})`
            default:
                return `Process step ${node.stepId}`
        }
    }

    return (
        <div className={`relative pl-8 ${!isLast ? "pb-8 border-l border-muted" : ""} last:border-l-0`}>
            <div className="absolute -left-1.5 mt-1.5">
                <WorkflowRunStepStatusIcon status={node.status} />
            </div>

            <div className="flex flex-col space-y-2">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold">{node.stepId}</h3>
                            <StepStatusBadge status={node.status} />
                            {node.type === "foreach" && (
                                <Badge variant="outline" className="ml-2">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    For Each
                                </Badge>
                            )}
                            {node.type === "loop" && (
                                <Badge variant="outline" className="ml-2">
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    {node.loopType === "dowhile" ? "Do While" : "Do Until"}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">{getStepDescription(node)}</p>
                    </div>
                </div>

                {(node.type === "foreach" || node.type === "loop") && node.children && node.children.length > 0 && (
                    <div className="mt-2">
                        <Button variant="outline" size="sm" onClick={onShowDetails}>
                            Show Details ({node.children.length} iterations)
                        </Button>
                    </div>
                )}

                {node.status === StepStatus.Success && node.output && node.type !== "foreach" && node.type !== "loop" && (
                    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="px-2 py-1 h-auto text-xs">
                                {isOpen ? "Hide details" : "Show details"}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                            <div className="bg-muted p-3 rounded-md">{renderStepOutput(node.output)}</div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {node.status === StepStatus.Failed && node.error && (
                    <div className="mt-2 bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-700">{node.error}</div>
                )}
            </div>
        </div>
    )
}
