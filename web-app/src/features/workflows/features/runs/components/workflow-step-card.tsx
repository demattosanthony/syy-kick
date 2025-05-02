import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  WorkflowRunStep,
  WorkflowRunStepMessage,
  WorkflowRunStepMessageToolCall,
} from "@/features/workflows/workflows.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import React, { useState } from "react";
import { ThinkingDropdown } from "@/features/chat/messages/components";
import { Button } from "@/components/ui/button";

interface WorkflowStepCardProps {
  step: WorkflowRunStep;
  duration: string | null;
}

// Define a new component to display messages and tool calls
export const StepMessagesDisplay: React.FC<{
  messages: WorkflowRunStepMessage[];
}> = ({ messages }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedToolResults, setExpandedToolResults] = useState<
    Record<string, boolean>
  >({});

  const toggleToolResultExpansion = (toolCallId: string) => {
    setExpandedToolResults((prev) => ({
      ...prev,
      [toolCallId]: !prev[toolCallId],
    }));
  };

  if (!messages || messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No messages recorded for this step.
      </p>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "space-y-4 p-2 rounded-md transition-all duration-300 ease-in-out",
          isExpanded ? "" : "max-h-[150px] overflow-hidden relative"
        )}
      >
        {messages.map((message, index) => (
          <React.Fragment key={index}>
            {index > 0 && <hr className="my-4 border-border/50" />}

            {message.reasoning && (
              <ThinkingDropdown>
                <p className="text-sm mb-2 whitespace-pre-wrap">
                  {message.reasoning}
                </p>
              </ThinkingDropdown>
            )}

            {message.text && (
              <p className="text-sm mb-2 whitespace-pre-wrap">{message.text}</p>
            )}

            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className=" space-y-2">
                {message.toolCalls.map((toolCall) => (
                  <div
                    key={toolCall.id}
                    className="my-2 p-2 border rounded-md bg-muted/50"
                  >
                    <p className="text-sm font-semibold mb-1">
                      Tool: {toolCall.toolName}
                    </p>
                    {toolCall.args && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          Arguments:
                        </p>
                        <pre className="text-xs bg-background p-2 rounded-md overflow-x-auto">
                          {JSON.stringify(toolCall.args, null, 2)}
                        </pre>
                      </div>
                    )}
                    {toolCall.result && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">
                          Result ({toolCall.status}):
                        </p>
                        <div
                          className={cn(
                            "relative overflow-hidden transition-all duration-300 ease-in-out",
                            !expandedToolResults[toolCall.id] && "max-h-[100px]"
                          )}
                        >
                          <pre className="text-xs bg-background p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
                            {typeof toolCall.result === "string"
                              ? toolCall.result
                              : JSON.stringify(toolCall.result, null, 2)}
                          </pre>
                          {!expandedToolResults[toolCall.id] && (
                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/50 to-transparent pointer-events-none" />
                          )}
                        </div>
                        <Button
                          variant="link"
                          className="mt-1 px-0 text-xs border-0 h-auto"
                          onClick={() => toggleToolResultExpansion(toolCall.id)}
                        >
                          {expandedToolResults[toolCall.id]
                            ? "See Less"
                            : "See More"}
                        </Button>
                      </div>
                    )}
                    {toolCall.status === "failed" && !toolCall.result && (
                      <p className="text-xs text-red-600 mt-1">
                        Status: {toolCall.status}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
        {!isExpanded && messages.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
      {messages.length > 0 && (
        <Button
          variant="link"
          className="mt-2 px-0 text-sm border-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "See Less" : "See More"}
        </Button>
      )}
    </div>
  );
};

export function WorkflowStepCard({ step, duration }: WorkflowStepCardProps) {
  const status = step.status;
  const isRunning = status === "running";
  const isPending = status === "pending";

  const agentName = step.workflowStep?.name;
  const model = step.workflowStep?.model;

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
