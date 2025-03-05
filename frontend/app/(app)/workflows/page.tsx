"use client";

import api from "@/lib/api";

export default function WorkflowsPage() {
  async function startWorkflow() {
    const { workflowRunId } = await api.workflows.runWorkflow(
      "Analyze the mechanical drawings"
    );
    console.log("Started workflow:", workflowRunId);

    // Poll for workflow logs every 10 seconds
    const intervalId = setInterval(async () => {
      try {
        const status = await api.workflows.getWorkflowLogs(workflowRunId);
        console.log("Workflow status:", status);
      } catch (error) {
        console.error("Error fetching workflow logs:", error);
        clearInterval(intervalId);
      }
    }, 10000);

    // Initial fetch
    const status = await api.workflows.getWorkflowLogs(workflowRunId);
    console.log("Initial workflow status:", status);
  }

  return (
    <div>
      <button onClick={startWorkflow}>Start Workflow</button>
    </div>
  );
}
