import { useEffect } from "react";

export function useRunSSE({ workflowId, workflowRunId }: { workflowId: string, workflowRunId: string }) {
    useEffect(() => {
        const eventSource = new EventSource(`/workflows/${workflowId}/runs/${workflowRunId}/events`);
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data, '<---- DATA');
        };
        return () => eventSource.close();
    }, [])
}