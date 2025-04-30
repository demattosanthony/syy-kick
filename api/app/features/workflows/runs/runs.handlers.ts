import { Request, Response } from "express";
import { eventBus, workflowRunsOps } from "./runs.ops";
import {
  WorkflowExecutionInputValuesSchema,
  WorkflowProgressUpdate,
  WorkflowRun,
  WorkflowRunStep,
} from "../workflows.types";
import { ToolName } from "../../tools/tools.types";

export const workflowsRunsHandlers = {
  createRun: async (req: Request, res: Response) => {
    const { workflowId, inputValues } = req.body;

    // Validate inputValues using Zod
    const validationResult =
      WorkflowExecutionInputValuesSchema.safeParse(inputValues);

    if (!validationResult.success) {
      // Construct a user-friendly error message from Zod issues
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      res.status(400).json({ error: `Invalid inputValues: ${errorMessages}` });
      return;
    }

    // Use the validated data from Zod
    const validatedInputValues = validationResult.data;

    const workflowRun = await workflowRunsOps.createWorkflowRun(
      workflowId,
      validatedInputValues,
      req.dbUser?.id as string
    );
    res.json(workflowRun);
  },

  getRun: async (req: Request, res: Response) => {
    const { workflowId, workflowRunId } = req.params;

    const workflowRun = await workflowRunsOps.getWorkflowRun(
      workflowId,
      workflowRunId
    );
    res.json(workflowRun);
  },

  // Kick off a workflow run
  run: async (req: Request, res: Response) => {
    const { workflowId, workflowRunId } = req.params;

    try {
      // Fetch the workflow run and all its steps
      const workflowRun = await workflowRunsOps.getWorkflowRun(
        workflowId,
        workflowRunId
      );

      if (!workflowRun.workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      const workflowSteps: WorkflowRunStep[] = workflowRun.steps?.map(
        (step) => {
          const agent = step.workflowStep?.agents;
          const stepData = step.workflowStep;

          // If theres an agent use the agent info
          // If not that means its a custom step and we use the step data
          const name = agent?.name ?? stepData?.name ?? "";
          const description = agent?.description ?? stepData?.description ?? "";
          const instructions =
            agent?.instructions ?? stepData?.instructions ?? "";
          const model = agent?.model ?? stepData?.model ?? "";
          const activeTools = (agent?.activeTools ??
            stepData?.activeTools ??
            []) as ToolName[];

          return {
            id: step.id,
            name,
            description,
            instructions,
            model,
            activeTools,
          };
        }
      );

      const workflowRunData: WorkflowRun = {
        runId: workflowRun.id,
        workflowId: workflowRun.workflowId,
        name: workflowRun.workflow.name,
        description: workflowRun.workflow.description ?? undefined,
        workflowSteps,
        executionInputValues: workflowRun.executionInputValues,
      };

      workflowRunsOps.runWorkflow(workflowRunData);

      // Send a response indicating the workflow run has started
      res.status(202).json({
        message: "Workflow run initiated successfully.",
        workflowRunId: workflowRunId,
      });
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },

  getRunEvents: async (req: Request, res: Response) => {
    const { workflowId } = req.params;

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders(); // Flush the headers to establish the connection

    const listener = (event: WorkflowProgressUpdate) => {
      res.write(`data: ${JSON.stringify(event)}\\n\\n`); // Format as SSE message
    };

    // Add listener for the specific workflowId
    eventBus.on(workflowId, listener);

    // Handle client disconnect
    req.on("close", () => {
      eventBus.removeListener(workflowId, listener);
      res.end(); // End the response when the client disconnects
    });

    // Send a comment to keep the connection alive if needed (optional)
    const keepAliveInterval = setInterval(() => {
      res.write(": keep-alive\\n\\n");
    }, 30000); // Send every 30 seconds

    // Clean up interval on close
    req.on("close", () => {
      clearInterval(keepAliveInterval);
    });
  },
};
