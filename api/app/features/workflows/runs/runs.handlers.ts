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
    try {
      // Validate required fields
      if (!req.body.workflowId) {
        res.status(400).json({ error: "workflowId is required" });
        return;
      }

      const { workflowId, inputValues } = req.body;

      // Validate inputValues using Zod
      const validationResult =
        WorkflowExecutionInputValuesSchema.safeParse(inputValues);

      if (!validationResult.success) {
        // Construct a user-friendly error message from Zod issues
        const errorMessages = validationResult.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        res
          .status(400)
          .json({ error: `Invalid inputValues: ${errorMessages}` });
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
    } catch (error: any) {
      console.error("Error creating workflow run:", error);

      // Handle specific error types
      if (error.message?.includes("Workflow not found")) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      if (error.message?.includes("Database transaction failed")) {
        res.status(500).json({ error: "Database error occurred" });
        return;
      }

      // Generic error response
      res.status(500).json({
        error: "An error occurred while creating the workflow run",
        message: error.message,
      });
    }
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
        res.status(404).json({ error: "Workflow run not found" });
        return;
      }

      const workflowSteps: WorkflowRunStep[] = workflowRun.steps?.map(
        (step) => {
          const agent = step.workflowStep?.agent;
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
    try {
      const { workflowId } = req.params;

      if (!workflowId) {
        throw new Error("Workflow ID is required");
      }

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Transfer-Encoding", "chunked");
      res.flushHeaders(); // Flush the headers to establish the connection

      const listener = (event: WorkflowProgressUpdate) => {
        try {
          const message = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          res.write(message);
        } catch (error) {
          console.error("Error writing SSE message:", error);
          // Don't throw here - we want to keep the connection alive even if one message fails
        }
      };

      // Add listener for the specific workflowId
      eventBus.on(workflowId, listener);

      // Handle client disconnect
      const cleanup = () => {
        try {
          eventBus.removeListener(workflowId, listener);
          clearInterval(keepAliveInterval);
          res.end();
        } catch (error) {
          console.error("Error during cleanup:", error);
        }
      };

      req.on("close", cleanup);
      req.on("error", (error) => {
        console.error("Error on request:", error);
        cleanup();
      });

      // Send a comment to keep the connection alive
      const keepAliveInterval = setInterval(() => {
        try {
          if (!res.writableEnded) {
            res.write(": keep-alive\n\n");
          }
        } catch (error) {
          console.error("Error sending keep-alive:", error);
          cleanup();
        }
      }, 30000);

      // Send initial connection success message
      res.write(": connected\n\n");
    } catch (error) {
      console.error("Error in getRunEvents:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to establish event stream" });
      } else {
        // If headers already sent, try to close the connection gracefully
        try {
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: "Stream error occurred" })}\n\n`
          );
          res.end();
        } catch (closeError) {
          console.error("Error closing stream:", closeError);
        }
      }
    }
  },

  getRuns: async (req: Request, res: Response) => {
    const { workflowId } = req.params;

    const runs = await workflowRunsOps.getWorkflowRuns(workflowId);
    res.json(runs);
  },
};
