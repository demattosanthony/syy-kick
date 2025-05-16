import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatFileSize } from "@/features/workflows/utils"
import { CustomWorkflowRun } from "@/features/workflows/workflows.types"
import { FileText } from "lucide-react"

export function WorkflowRunInput({ runState }: { runState: CustomWorkflowRun }) {

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle>Input</CardTitle>
                <CardDescription>Workflow input data</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {runState.snapshot.context.input &&
                        Object.entries(runState.snapshot.context.input).map(([key, value]) => (
                            <div key={key} className="bg-muted/50 rounded-lg p-4">
                                <h3 className="text-sm font-medium">{value?.label || key}</h3>
                                {value.type === "file" && (
                                    <Button onClick={() => {
                                        window.open(value.value.url, "_blank")
                                    }} variant="ghost" className="flex items-center mt-2 text-sm">
                                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <span>{value.value.fileName}</span>
                                        {value.value.fileSize && (
                                            <span className="text-xs text-muted-foreground ml-2">
                                                ({formatFileSize(value.value.fileSize)})
                                            </span>
                                        )}
                                    </Button>
                                )}
                            </div>
                        ))}
                </div>
            </CardContent>
        </Card>
    )
}