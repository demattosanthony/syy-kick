import { useEffect } from "react";
import { WorkflowProgressUpdate } from "../types/runs";

export function useRunSSE({
  workflowId,
  workflowRunId,
}: {
  workflowId: string;
  workflowRunId: string;
}) {
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
        console.log(`Received event type: ${event.type}`, event);
        const parsedData = JSON.parse(event.data);

        // Create a typed event object based on the event type
        const typedEvent: WorkflowProgressUpdate = {
          type: event.type as WorkflowProgressUpdate["type"],
          data: parsedData,
        };

        console.log("Parsed typed event:", typedEvent);

        // TODO: Add logic here to update state based on the typedEvent
      } catch (error) {
        console.error(
          "Error parsing SSE data:",
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
      eventSource.close(); // Close the connection on error
    };

    console.log("EventSource connected:", eventSource);

    // Cleanup function to close the connection and remove listeners
    return () => {
      console.log("Closing EventSource connection");
      eventTypes.forEach((type) => {
        eventSource.removeEventListener(type, handleEvent);
      });
      eventSource.close();
    };
  }, [workflowId, workflowRunId]); // Add dependencies
}
