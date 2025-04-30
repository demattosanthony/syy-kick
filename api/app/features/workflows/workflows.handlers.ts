import { Request, Response } from "express";
import { workflowsOps } from "./workflows.ops";
import db from "../../config/db";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const orgWorkflows = await workflowsOps.getWorkflows({
        orgId: req.workspace?.id as string,
      });

      res.json(orgWorkflows);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const workflow = await workflowsOps.getWorkflow(id as any);

      if (!workflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      res.json(workflow);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  create: async (req: Request, res: Response) => {
    const { name, description, workflowSteps } = req.body;

    try {
      db.transaction(
        async (tx) => {
          const workflow = await workflowsOps.createWorkflow(req.dbUser!.id, name, description, tx);
          await workflowsOps.createWorkflowSteps(workflow.id, workflowSteps, tx);
        }
      );

      res.status(201).json({ message: "Workflow created successfully" });
    } catch (error) {
      console.error("Error creating workflow:", error);
      res.status(500).json({ error: "Failed to create workflow" });
    }
  },
};

export default workflowHandlers;
