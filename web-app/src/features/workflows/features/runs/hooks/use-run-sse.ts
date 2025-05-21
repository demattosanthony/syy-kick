import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VNextWorkflowWatchResult } from "@mastra/client-js";
import { CustomWorkflowRun } from "@/features/workflows/workflows.types";

export function useRunSSE({
  workflowId,
  workflowRunId,
}: {
  workflowId: string;
  workflowRunId: string;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workflowId || !workflowRunId) return;
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL
      }/workflows/${workflowId}/runs/${workflowRunId}/events`,
      {
        withCredentials: true,
      }
    );

    const handleEvent = (event: MessageEvent) => {
      try {
        const parsedData = JSON.parse(event.data) as VNextWorkflowWatchResult;

        // Update the React Query cache immutably
        queryClient.setQueryData(
          ["runs", workflowId, workflowRunId],
          (oldData: CustomWorkflowRun) => {
            const newRunContext = parsedData.payload.workflowState.steps;

            if (newRunContext) {
              const mergedContext = {
                ...(oldData?.snapshot?.context || {}),
                ...Object.entries(newRunContext).reduce((acc, [stepId, stepData]) => {
                  acc[stepId] = {
                    ...(oldData?.snapshot?.context?.[stepId] || {}),
                    ...stepData
                  };
                  return acc;
                }, {} as Record<string, any>)
              };

              return {
                ...(oldData || {}),
                updatedAt: new Date(parsedData.eventTimestamp),
                snapshot: {
                  ...(oldData?.snapshot || {}),
                  context: mergedContext
                }
              };
            }

            return oldData;
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

    eventSource.onmessage = handleEvent;

    // Optional: Listener for errors from the EventSource connection itself
    eventSource.onerror = (error) => {
      console.error("EventSource failed:", error);
      eventSource.close();
    };

    // Cleanup function to close the connection
    return () => {
      eventSource.close();
    };
  }, [workflowId, workflowRunId]);
}
