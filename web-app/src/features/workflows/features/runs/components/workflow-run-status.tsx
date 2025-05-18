import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, Loader2, Clock, SkipForward } from "lucide-react"
import { StepOutputValue } from "@/features/workflows/workflows.types"
import { formatStepName, renderStepOutput } from "@/features/workflows/utils"
import { Progress } from "@/components/ui/progress"
import { useMemo } from "react"

type WorkflowRunStatusProps = {
    completedSteps: number
    totalSteps: number
    status: string
    hasFailed: boolean
    isCompleted: boolean
    duration: string
    startTime: string
    lastOutput: StepOutputValue | undefined
    lastStep?: {
        id: string
        name: string
        status: string
        error?: string
    }
}

export function WorkflowRunStatus({
    completedSteps,
    totalSteps,
    status,
    hasFailed,
    isCompleted,
    duration,
    startTime,
    lastOutput,
    lastStep
}: WorkflowRunStatusProps) {
    const progress = Math.round((completedSteps / totalSteps) * 100)

    const statusTitle = useMemo(() => {

        if (hasFailed) {
            return "Failed"
        }

        if (isCompleted) {
            return "Completed"
        }

        if (lastStep) {
            return `In Progress: ${formatStepName(lastStep.name)}`
        }

        return "In Progress"


    }, [hasFailed, isCompleted, lastStep])

    return (
        <>
            {!isCompleted && !hasFailed ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-sm text-muted-foreground">
                            {completedSteps} of {totalSteps} steps completed
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <StatusCard
                            title="Current Status"
                            value={statusTitle}
                            status={status}
                            description={
                                hasFailed
                                    ? "One or more steps failed"
                                    : isCompleted
                                        ? "All steps completed successfully"
                                        : "Workflow is running"
                            }
                            stepName={lastStep?.name}
                        />
                        <StatusCard
                            title="Duration"
                            value={duration ?? "0s"}
                            status="info"
                            description={`Started at ${startTime}`}
                            stepName={lastStep?.name}
                        />
                    </div>
                </div>
            ) : hasFailed ? (
                <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <h2 className="text-lg font-semibold text-red-700">Run Failed</h2>
                    </div>
                    {lastStep ? (
                        <div className="space-y-3">
                            <p className="text-sm text-red-600">
                                Step "{formatStepName(lastStep.name)}" has failed
                            </p>
                            {lastStep.error && (
                                <div className="bg-white rounded-lg p-4 border border-red-100">
                                    <p className="text-sm font-medium text-red-700 mb-2">Error details:</p>
                                    <p className="text-sm text-red-600 whitespace-pre-wrap max-h-40 overflow-y-auto">{JSON.stringify(lastStep.error, null, 2)}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-red-600">
                            One or more steps in the workflow have failed. Please check the timeline for more details.
                        </p>
                    )}
                </Card>
            ) : (
                lastOutput && (
                    <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <h2 className="text-lg font-semibold text-green-700">Result</h2>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-green-100">
                            {renderStepOutput(lastOutput)}
                        </div>
                    </Card>
                )
            )
            }
        </>
    )
}

function StatusCard({ title, value, status, description }: { title: string, value: string, status: string, description: string, stepName?: string }) {
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