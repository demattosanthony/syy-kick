import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StepStatusBadge } from "./workflow-run-step-status-badge"
import { TreeNode } from "@/features/workflows/workflows.types"
import { renderStepOutput } from "@/features/workflows/utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function StepDetailsDialog({ node, onClose }: { node: TreeNode; onClose: () => void }) {
    return (
        <Dialog open={!!node} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle>{node.stepId}</DialogTitle>
                    <DialogDescription>{node.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Status</h4>
                            <StepStatusBadge status={node.status} />
                        </div>
                    </div>

                    {node.type === "foreach" && node.children && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Iterations</h4>
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Index</th>
                                            <th className="px-4 py-2 text-left">Status</th>
                                            <th className="px-4 py-2 text-left">Duration</th>
                                            <th className="px-4 py-2 text-left">Output</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {node.children.map((child, idx) => (
                                            <tr key={idx} className="border-t border-muted">
                                                <td className="px-4 py-2">{child.foreachIndex}</td>
                                                <td className="px-4 py-2">
                                                    <StepStatusBadge status={child.status} />
                                                </td>
                                                <td className="px-4 py-2">
                                                    {child.startedAt && child.finishedAt
                                                        ? `${((child.finishedAt - child.startedAt) / 1000).toFixed(2)}s`
                                                        : "N/A"}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {child.output ? (
                                                        <Collapsible>
                                                            <CollapsibleTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                                                    View Output
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent className="mt-2 p-2 bg-muted rounded-md">
                                                                {renderStepOutput(child.output)}
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    ) : (
                                                        "No output"
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {node.type === "loop" && node.children && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Loop Iterations</h4>
                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Iteration</th>
                                            <th className="px-4 py-2 text-left">Status</th>
                                            <th className="px-4 py-2 text-left">Duration</th>
                                            <th className="px-4 py-2 text-left">Output</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {node.children.map((child, idx) => (
                                            <tr key={idx} className="border-t border-muted">
                                                <td className="px-4 py-2">{child.iteration}</td>
                                                <td className="px-4 py-2">
                                                    <StepStatusBadge status={child.status} />
                                                </td>
                                                <td className="px-4 py-2">
                                                    {child.startedAt && child.finishedAt
                                                        ? `${((child.finishedAt - child.startedAt) / 1000).toFixed(2)}s`
                                                        : "N/A"}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {child.output ? (
                                                        <Collapsible>
                                                            <CollapsibleTrigger asChild>
                                                                <Button variant="outline" size="sm" className="h-7 text-xs">
                                                                    View Output
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent className="mt-2 p-2 bg-muted rounded-md">
                                                                {renderStepOutput(child.output)}
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    ) : (
                                                        "No output"
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {node.output && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Output</h4>
                            <div className="bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words w-[700px]">{renderStepOutput(node.output)}</div>
                        </div>
                    )}

                    {node.error && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-red-700">Error</h4>
                            <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm text-red-700 overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(node?.error, null, 2)}</div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}