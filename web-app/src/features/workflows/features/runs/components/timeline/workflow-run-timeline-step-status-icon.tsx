import { StepStatus } from "@/features/workflows/workflows.types";
import { Check, Clock, Loader2, RefreshCw, SkipForward, X } from "lucide-react";

export function WorkflowRunTimelineStepStatusIcon({ status, type }: { status: StepStatus; type: string }) {
    if (type === "foreach" || type === "loop") {
        return (
            <div className="flex items-center justify-center w-3 h-3 rounded-full bg-primary">
                <RefreshCw className="h-2 w-2 text-primary-foreground" />
            </div>
        )
    }

    switch (status) {
        case StepStatus.Success:
            return (
                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-green-500">
                    <Check className="h-2 w-2 text-white" />
                </div>
            )
        case StepStatus.Failed:
            return (
                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-red-500">
                    <X className="h-2 w-2 text-white" />
                </div>
            )
        case StepStatus.Waiting:
            return (
                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-yellow-500">
                    <Clock className="h-2 w-2 text-white" />
                </div>
            )
        case StepStatus.Skipped:
            return (
                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-gray-400">
                    <SkipForward className="h-2 w-2 text-white" />
                </div>
            )
        case StepStatus.Running:
            return (
                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-blue-500">
                    <Loader2 className="h-2 w-2 text-white animate-spin" />
                </div>
            )
        default:
            return <div className="flex items-center justify-center w-3 h-3 rounded-full bg-gray-300"></div>
    }
}