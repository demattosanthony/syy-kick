import { StepStatus } from "@/features/workflows/workflows.types"
import { Check, X, Loader2, Clock, SkipForward } from "lucide-react"

export function WorkflowRunStepStatusIcon({ status }: { status: StepStatus }) {
    switch (status) {
        case StepStatus.Success:
            return <Check className="h-2 w-2 text-white" />
        case StepStatus.Failed:
            return <X className="h-2 w-2 text-white" />
        case StepStatus.Running:
            return <Loader2 className="h-2 w-2 text-white animate-spin" />
        case StepStatus.Waiting:
            return <Clock className="h-2 w-2 text-white" />
        case StepStatus.Skipped:
            return <SkipForward className="h-2 w-2 text-white" />
        default:
            return null
    }
}