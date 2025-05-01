import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WorkflowProgressUpdate } from "../types/runs";
import {
  WorkflowRun,
  WorkflowRunStepMessage,
  WorkflowRunStepOutput,
  WorkflowFile,
} from "@/features/workflows/workflows.types";

export function useRunSSE({
  workflowId,
  workflowRunId,
}: {
  workflowId: string;
  workflowRunId: string;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource(
      `${
        import.meta.env.VITE_API_URL
      }/workflows/${workflowId}/runs/${workflowRunId}/events`,
      {
        withCredentials: true,
      }
    );

    const handleEvent = (event: MessageEvent) => {
      try {
        // console.log(`Received event type: ${event.type}`, event);
        const parsedData = JSON.parse(event.data);

        // Create a typed event object based on the event type
        const typedEvent: WorkflowProgressUpdate = {
          type: event.type as WorkflowProgressUpdate["type"],
          data: parsedData,
        };

        // console.log("Parsed typed event:", typedEvent);

        // Update the React Query cache immutably
        queryClient.setQueryData<WorkflowRun>(
          ["runs", workflowId, workflowRunId],
          (oldData) => {
            if (!oldData) return oldData;

            // Start with a shallow copy
            let updatedData = { ...oldData };

            switch (typedEvent.type) {
              case "workflow_start":
                updatedData = {
                  ...updatedData,
                  status: "running",
                  updatedAt: new Date().toISOString(),
                };
                break;
              case "workflow_step_start": {
                updatedData = {
                  ...updatedData,
                  steps: updatedData.steps.map((step) =>
                    step.id === typedEvent.data.stepId
                      ? {
                          ...step,
                          status: "running",
                          updatedAt: new Date().toISOString(),
                        }
                      : step
                  ),
                  updatedAt: new Date().toISOString(),
                };
                break;
              }
              case "workflow_step_message": {
                updatedData = {
                  ...updatedData,
                  steps: updatedData.steps.map((step) => {
                    if (step.id === typedEvent.data.stepId) {
                      const newMessage: WorkflowRunStepMessage = {
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        role: typedEvent.data.role,
                        text: typedEvent.data.text,
                        reasoning: typedEvent.data.reasoning,
                        toolCalls: typedEvent.data.toolCalls,
                      };
                      return {
                        ...step,
                        messages: [...step.messages, newMessage],
                        updatedAt: new Date().toISOString(),
                      };
                    } else {
                      return step;
                    }
                  }),
                  updatedAt: new Date().toISOString(),
                };
                break;
              }
              case "workflow_step_artifact_event": {
                if (typedEvent.data.artifact.type !== "created") break;

                updatedData = {
                  ...updatedData,
                  steps: updatedData.steps.map((step) => {
                    if (step.id === typedEvent.data.stepId) {
                      const newFile: WorkflowFile = {
                        id: typedEvent.data.artifact.fileKey,
                        name: typedEvent.data.artifact.filename,
                        mimeType: typedEvent.data.artifact.mimeType,
                        url: typedEvent.data.artifact.url,
                        createdAt: new Date(
                          typedEvent.data.artifact.ts * 1000
                        ).toISOString(),
                        updatedAt: new Date(
                          typedEvent.data.artifact.ts * 1000
                        ).toISOString(),
                      };
                      const newOutput: WorkflowRunStepOutput = {
                        id: crypto.randomUUID(),
                        file: newFile,
                      };
                      return {
                        ...step,
                        outputs: [...step.outputs, newOutput],
                        updatedAt: new Date().toISOString(),
                      };
                    } else {
                      return step;
                    }
                  }),
                  updatedAt: new Date().toISOString(),
                };
                break;
              }
              case "workflow_step_finish": {
                updatedData = {
                  ...updatedData,
                  steps: updatedData.steps.map((step) =>
                    step.id === typedEvent.data.stepId
                      ? {
                          ...step,
                          status: "completed",
                          updatedAt: new Date().toISOString(),
                        }
                      : step
                  ),
                  updatedAt: new Date().toISOString(),
                };
                break;
              }
              case "workflow_step_error": {
                updatedData = {
                  ...updatedData,
                  steps: updatedData.steps.map((step) =>
                    step.id === typedEvent.data.stepId
                      ? {
                          ...step,
                          status: "failed",
                          updatedAt: new Date().toISOString(),
                        }
                      : step
                  ),
                  updatedAt: new Date().toISOString(),
                };
                break;
              }
              case "workflow_complete":
                updatedData = {
                  ...updatedData,
                  status: "completed",
                  updatedAt: new Date().toISOString(),
                };
                break;
              case "workflow_error":
                updatedData = {
                  ...updatedData,
                  status: "failed",
                  updatedAt: new Date().toISOString(),
                };
                break;
            }

            return updatedData;
          }
        );
      } catch (error) {
        console.error(
          "Error parsing SSE data or updating cache:",
          error,
          "Raw data:",
          event.data
        );
      }
    };

    // Derive event types from WorkflowProgressUpdate
    const eventTypes = (
      [
        "workflow_start",
        "workflow_step_start",
        "workflow_step_message",
        "workflow_step_artifact_event",
        "workflow_step_finish",
        "workflow_step_error",
        "workflow_complete",
        "workflow_error",
      ] as const
    ).filter((type): type is WorkflowProgressUpdate["type"] => true);

    // Add listeners for specific event types
    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, handleEvent);
    });

    // Optional: Listener for errors from the EventSource connection itself
    eventSource.onerror = (error) => {
      console.error("EventSource failed:", error);
      eventSource.close();
    };

    // Cleanup function to close the connection and remove listeners
    return () => {
      eventTypes.forEach((type) => {
        eventSource.removeEventListener(type, handleEvent);
      });
      eventSource.close();
    };
  }, [workflowId, workflowRunId]);
}
