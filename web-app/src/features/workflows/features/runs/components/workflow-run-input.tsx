import { renderFile } from "@/features/workflows/utils"
import { CustomWorkflowRun, VNextWorkflowRunState } from "@/features/workflows/workflows.types"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

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
                        {value?.value?.length > 100
                            ? value.value.substring(0, 100) + "..."
                            : value.value}
                    </div>
                );
            case "number":
                return (
                    <div className="text-sm">
                        <span className="font-medium">Number:</span> {value?.value}
                    </div>
                );
            case "boolean":
                return (
                    <div className="text-sm">
                        <span className="font-medium">Boolean:</span> {value?.boolean ? "Vrai" : "Faux"}
                    </div>
                );
            default:
                return (
                    <pre className="text-xs overflow-auto max-h-[200px] bg-muted/50 p-2 rounded-md">
                        {JSON.stringify(value?.value, null, 2)}
                    </pre>
                );
        }
    };

    return (
        <Accordion
            type="single"
            collapsible
            className="w-full rounded-md border hover:shadow-md transition-shadow overflow-hidden"
        >
            <AccordionItem value="inputs" className="border-none">
                <AccordionTrigger className="px-4 py-4 hover:bg-muted">
                    <div className="flex items-center gap-2 w-full">
                        <h3 className="text-md font-medium">Inputs</h3>
                        <span className="text-xs text-muted-foreground">Workflow inputs</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 border-t border-border">
                    <div className="space-y-4">
                        {runState.snapshot.context.input &&
                            Object.entries(runState.snapshot.context.input).map(([key, value]) => (
                                <div key={key} className="p-4">
                                    <h3 className="text-sm font-medium mb-2">{value?.label || key}</h3>
                                    {renderInputValue(value)}
                                </div>
                            ))}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}