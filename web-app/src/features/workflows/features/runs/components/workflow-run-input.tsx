import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { renderFile } from "@/features/workflows/utils"
import { CustomWorkflowRun, VNextWorkflowRunState } from "@/features/workflows/workflows.types"

export function WorkflowRunInput({ runState }: { runState: CustomWorkflowRun }) {
    const renderInputValue = (value: VNextWorkflowRunState["context"]["input"]) => {
        if (!value) return null;

        switch (value.type) {
            case "file":
                return renderFile(value.value);
            case "text":
                return (
                    <div className="text-sm">
                        <span className="font-medium">Text:</span>{" "}
                        {value.value.text.length > 100
                            ? value.value.text.substring(0, 100) + "..."
                            : value.value.text}
                    </div>
                );
            case "number":
                return (
                    <div className="text-sm">
                        <span className="font-medium">Number:</span> {value.value.number}
                    </div>
                );
            case "boolean":
                return (
                    <div className="text-sm">
                        <span className="font-medium">Boolean:</span> {value.value.boolean ? "Vrai" : "Faux"}
                    </div>
                );
            default:
                return (
                    <pre className="text-xs overflow-auto max-h-[200px] bg-muted/50 p-2 rounded-md">
                        {JSON.stringify(value.value, null, 2)}
                    </pre>
                );
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Workflow inputs</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {runState.snapshot.context.input &&
                        Object.entries(runState.snapshot.context.input).map(([key, value]) => (
                            <div key={key} className="bg-muted/50 rounded-lg p-4">
                                <h3 className="text-sm font-medium mb-2">{value?.label || key}</h3>
                                {renderInputValue(value)}
                            </div>
                        ))}
                </div>
            </CardContent>
        </Card>
    )
}