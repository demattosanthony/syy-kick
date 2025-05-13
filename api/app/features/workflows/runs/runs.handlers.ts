import { Request, Response } from "express";
import { workflowRunsOps } from "./runs.ops";

export const workflowsRunsHandlers = {
  createRun: async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const input = req.body;

      const run = await workflowRunsOps.createRun(workflowId, input);

      res.json(run);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create run" });
    }
  },

  getRuns: async (req: Request, res: Response) => {
    try {
      const { workflowId } = req.params;
      const runs = await workflowRunsOps.getRuns(workflowId);
      res.json(runs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get runs" });
    }
  },

  getRun: async (req: Request, res: Response) => {
    try {
      const { workflowId, workflowRunId } = req.params;
      const run = await workflowRunsOps.getRun(workflowId, workflowRunId);

      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }

      res.json(run);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get run" });
    }
  },

  getRunEvents: async (req: Request, res: Response) => {
    try {
      const { workflowId, workflowRunId } = req.params;

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send initial connection established message
      res.write("event: connected\ndata: {}\n\n");

      // Set up the watch handler
      await workflowRunsOps.watchRun(workflowId, workflowRunId, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Handle client disconnect
      req.on("close", () => {
        res.end();
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get run events" });
    }
  },
};
