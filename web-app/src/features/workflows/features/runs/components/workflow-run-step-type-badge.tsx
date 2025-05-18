import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"

export function StepTypeBadge({ type, loopType }: { type: string; loopType?: "dowhile" | "dountil" }) {
    switch (type) {
        case "step":
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Step
                </Badge>
            )
        case "foreach":
            return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    For Each
                </Badge>
            )
        case "loop":
            return (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {loopType === "dowhile" ? "Do While" : "Do Until"}
                </Badge>
            )
        case "parallel":
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Parallel
                </Badge>
            )
        case "conditional":
            return (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    Conditional
                </Badge>
            )
        default:
            return <Badge variant="outline">{type}</Badge>
    }
}