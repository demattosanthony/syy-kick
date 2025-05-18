import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Loader2, Clock, SkipForward } from "lucide-react"
import { StepOutputValue } from "@/features/workflows/workflows.types"
import { renderStepOutput } from "@/features/workflows/utils"

type WorkflowRunStatusProps = {
    completedSteps: number
    totalSteps: number
    status: string
    hasFailed: boolean
    isCompleted: boolean
    duration: string
    startTime: string
    lastOutput: StepOutputValue | undefined
}
export function WorkflowRunStatus({ completedSteps, totalSteps, status, hasFailed, isCompleted, duration, startTime, lastOutput }: WorkflowRunStatusProps) {

    return (
        <Card>
            <CardHeader className="pb-3" >
                <CardTitle>Run Status </CardTitle>
                < CardDescription > Current status of the workflow run and its steps </CardDescription>
            </CardHeader>
            < CardContent >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" >
                    <StatusCard
                        title="Steps Completed"
                        value={`${completedSteps}/${totalSteps}`
                        }
                        status={status}
                        description={`${Math.round((completedSteps / totalSteps) * 100)}% of steps completed`}
                    />
                    <StatusCard
                        title="Current Status"
                        value={hasFailed ? "Failed" : isCompleted ? "Completed" : "In Progress"}
                        status={status}
                        description={
                            hasFailed
                                ? "One or more steps failed"
                                : isCompleted
                                    ? "All steps completed successfully"
                                    : "Workflow is running"
                        }
                    />
                    <StatusCard title="Duration" value={duration ?? "0s"} status="info" description={`Started at ${startTime}`} />
                </div>
                {
                    lastOutput && (
                        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white rounded-xl p-6 mt-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <h2 className="text-lg font-semibold text-green-700">Result</h2>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-green-100">
                                {renderStepOutput(lastOutput)}
                            </div>
                        </Card>
                    )
                }
            </CardContent>
        </Card>
    )
}


function StatusCard({ title, value, status, description }: { title: string, value: string, status: string, description: string }) {
    return (
        <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <StatusBadge status={status} />
            </div>
            <p className="text-2xl font-bold mt-2">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
    )
}


function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "success":
            return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Success
                </Badge>
            )
        case "failed":
            return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <X className="h-3 w-3 mr-1" />
                    Failed
                </Badge>
            )
        case "in-progress":
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    In Progress
                </Badge>
            )
        case "waiting":
            return (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Waiting
                </Badge>
            )
        case "skipped":
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    <SkipForward className="h-3 w-3 mr-1" />
                    Skipped
                </Badge>
            )
        default:
            return <Badge variant="outline">{status}</Badge>
    }
}