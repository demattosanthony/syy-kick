import { TreeNode } from "@/features/workflows/workflows.types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatStepName, renderStepOutput } from "@/features/workflows/utils";
import { StepTypeBadge, StepStatusBadge } from "@/features/workflows/features/runs/components";

export function StepDetailRow({ node, onShowDetails }: { node: TreeNode; onShowDetails: () => void }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <TableRow>
                <TableCell className="font-medium">{formatStepName(node.stepId)}</TableCell>
                <TableCell>{node.path}</TableCell>
                <TableCell>
                    <StepTypeBadge type={node.type} loopType={node.loopType} />
                </TableCell>
                <TableCell>
                    <StepStatusBadge status={node.status} />
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                        {node.output && (
                            <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="h-8 px-2 text-xs">
                                {isOpen ? "Hide output" : "View output"}
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={onShowDetails} className="h-8 px-2 text-xs">
                            Details
                        </Button>
                    </div>
                </TableCell>
            </TableRow>

            {isOpen && node.output && (
                <TableRow>
                    <TableCell colSpan={5} className="p-0">
                        <div className="p-4 bg-muted/50">{renderStepOutput(node.output)}</div>
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}