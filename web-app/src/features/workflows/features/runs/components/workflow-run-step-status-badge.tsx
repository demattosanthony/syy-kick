import { StepStatus } from "@/features/workflows/workflows.types"
import { Badge } from "@/components/ui/badge"
import { Check, X, Clock, SkipForward, Loader2 } from "lucide-react"

export function StepStatusBadge({ status }: { status: StepStatus }) {
    switch (status) {
        case StepStatus.Success:
            return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Success
                </Badge>
            )
        case StepStatus.Failed:
            return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <X className="h-3 w-3 mr-1" />
                    Failed
                </Badge>
            )
        case StepStatus.Running:
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Running
                </Badge>
            )
        case StepStatus.Waiting:
            return (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Waiting
                </Badge>
            )
        case StepStatus.Skipped:
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skipped
                </Badge>
            )
        case StepStatus.Suspended:
            return (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Suspended
                </Badge>
            )
        case StepStatus.Pending:
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Pending
                </Badge>
            )
        case StepStatus.Blocked:
            return (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    Blocked
                </Badge>
            )
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}
