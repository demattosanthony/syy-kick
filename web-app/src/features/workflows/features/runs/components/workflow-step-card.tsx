import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  WorkflowRunStep,
  WorkflowRunStepMessage,
} from "@/features/workflows/workflows.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import React from "react";
import { MarkdownViewer } from "@/features/chat/messages/components";

interface WorkflowStepCardProps {
  step: WorkflowRunStep;
  duration: string | null;
}

// Define a new component to display messages and tool calls
const StepMessagesDisplay: React.FC<{ messages: WorkflowRunStepMessage[] }> = ({
  messages,
}) => {
  if (!messages || messages.length === 0) {
    return <p>No messages available for this step.</p>;
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
      {messages.map((message, index) => (
        <div key={index} className="p-3 border rounded-md bg-muted/20">
          <p className="font-semibold capitalize text-sm mb-1">
            {message.role}
          </p>
          {message.text && <p className="text-sm mb-2">{message.text}</p>}
          {message.reasoning && (
            <details className="text-xs text-muted-foreground mb-2">
              <summary className="cursor-pointer">Reasoning</summary>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                {message.reasoning}
              </pre>
            </details>
          )}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-medium">Tool Calls:</p>
              {message.toolCalls.map((toolCall) => (
                <div
                  key={toolCall.id}
                  className="p-2 border rounded bg-muted/50 text-xs"
                >
                  <p>
                    <strong>Tool:</strong> {toolCall.toolName}
                  </p>
                  <p>
                    <strong>Status:</strong> {toolCall.status}
                  </p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs">
                      Arguments
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                      {JSON.stringify(toolCall.args, null, 2)}
                    </pre>
                  </details>
                  {toolCall.result && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs">
                        Result
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                        {JSON.stringify(toolCall.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export function WorkflowStepCard({ step, duration }: WorkflowStepCardProps) {
  const status = step.status;
  const isRunning = status === "running";
  const isPending = status === "pending";

  const agentName = step.workflowStep?.name;
  const model = step.workflowStep?.model;

  const latestMessage =
    step.messages && step.messages.length > 0
      ? step.messages[step.messages.length - 1]
      : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card
          className={cn(
            "w-full shadow-md cursor-pointer hover:shadow-lg transition-shadow",
            isRunning && "border-blue-500 ring-1 ring-blue-500",
            isRunning && "animate-border-pulse",
            isPending && "border-dashed"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl font-bold">
              {step.workflowStep?.name || "Unnamed Step"}
            </CardTitle>
            <div
              className={cn(
                "flex items-center px-3 py-1 rounded-full text-sm font-medium",
                status === "completed" && "bg-green-100 text-green-800",
                status === "running" && "bg-blue-100 text-blue-800",
                status === "failed" && "bg-red-100 text-red-800",
                status === "pending" && "bg-yellow-100 text-yellow-800"
              )}
            >
              {status === "running" && (
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}
              {status}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {step.workflowStep?.description ||
                "Extract information from the input."}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-muted-foreground">Step</p>
                <p className="font-medium">{agentName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Model</p>
                <p className="font-medium">{model}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">
                  {duration ?? (isRunning || isPending ? "..." : "-")}
                </p>
              </div>
            </div>
            {latestMessage && latestMessage.text && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-1">
                  Latest Message:
                </p>
                <MarkdownViewer content={latestMessage.text} />
              </div>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[60vw]">
        <DialogHeader>
          <DialogTitle>
            Step Details: {step.workflowStep?.name || "Unnamed Step"}
          </DialogTitle>
        </DialogHeader>
        <StepMessagesDisplay messages={step.messages} />
      </DialogContent>
    </Dialog>
  );
}
