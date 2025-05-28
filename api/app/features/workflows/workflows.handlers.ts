import { Request, Response } from "express";
import { workflowsMastraOps } from "./workflows.mastra.ops";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const workflows = await workflowsMastraOps.getWorkflows(
        req.dbUser!.id,
        req.workspace?.type === "organization" ? req.workspace.id : undefined,
        req.query.query as string
      );
      res.status(200).json(workflows);
    } catch (error: any) {
      console.error("Error getting workflows:", error?.message);
      res.status(500).json({ error: "Failed to get workflows" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id: workflowId } = req.params;
    const workflow = await workflowsMastraOps.getWorkflow(
      workflowId,
      req.dbUser!.id,
      req.workspace?.type === "organization" ? req.workspace.id : undefined
    );
    res.status(200).json(workflow);
  },
};

export default workflowHandlers;
