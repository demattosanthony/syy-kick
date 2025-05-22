import { StepStatus } from "@/features/workflows/workflows.types"
import { Badge } from "@/components/ui/badge"
import { Check, X, Clock, SkipForward, Loader2 } from "lucide-react"

export function StepStatusBadge({ status }: { status: StepStatus }) {
    switch (status) {
        case StepStatus.Success:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-green-500 text-white border-green-600 flex items-center justify-center">
                    <Check className="h-5 w-5 font-bold" />
                </Badge>
            )
        case StepStatus.Failed:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-red-600 text-white border-red-600 flex items-center justify-center">
                    <X className="h-5 w-5" />
                </Badge>
            )
        case StepStatus.Running:
            return (
                <Loader2 className="h-6 w-6 animate-spin" />
            )
        case StepStatus.Waiting:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-yellow-500 text-white border-yellow-500 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                </Badge>
            )
        case StepStatus.Skipped:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-gray-400 text-white border-gray-400 flex items-center justify-center">
                    <SkipForward className="h-5 w-5" />
                </Badge>
            )
        case StepStatus.Suspended:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-purple-500 text-white border-purple-500 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                </Badge>
            )
        case StepStatus.Pending:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-gray-400 text-white border-gray-400 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                </Badge>
            )
        case StepStatus.Blocked:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-orange-500 text-white border-orange-500 flex items-center justify-center">
                    <X className="h-5 w-5" />
                </Badge>
            )
        default:
            return (
                <Badge variant="outline" className="h-6 w-6 p-0 rounded-full bg-gray-400 text-white border-gray-400 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                </Badge>
            )
    }
}
