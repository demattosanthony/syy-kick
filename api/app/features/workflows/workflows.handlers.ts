import { Request, Response } from "express";
import { workflowsOps } from "./workflows.ops";
import db from "../../config/db";
import { WorkflowUpdateRequest } from "./workflows.types";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const orgWorkflows = await workflowsOps.getWorkflows({
        orgId:
          req.workspace?.type === "organization"
            ? req.workspace?.id
            : undefined,
        userId: req.workspace?.type === "personal" ? req.dbUser?.id : undefined,
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
      db.transaction(async (tx) => {
        const workflow = await workflowsOps.createWorkflow(
          req.dbUser!.id,
          name,
          description,
          tx
        );
        await workflowsOps.createWorkflowSteps(workflow.id, workflowSteps, tx);

        if (req.workspace?.type === "organization") {
          await workflowsOps.createWorkflowOrganizationRelation(
            workflow.id,
            req.workspace.id,
            tx
          );
        } else {
          await workflowsOps.createWorkflowUserRelation(
            workflow.id,
            req.dbUser!.id,
            tx
          );
        }
      });

      res.status(201).json({ message: "Workflow created successfully" });
    } catch (error) {
      console.error("Error creating workflow:", error);
      res.status(500).json({ error: "Failed to create workflow" });
    }
  },

  update: async (req: Request, res: Response) => {
    const { id: workflowId } = req.params;
    const { name, description, workflowSteps } =
      req.body as WorkflowUpdateRequest;

    if (!workflowId) {
      res.status(400).json({ error: "Workflow ID is required" });
      return;
    }
    if (!Array.isArray(workflowSteps)) {
      res.status(400).json({ error: "workflowSteps must be an array" });
      return;
    }

    try {
      await db.transaction(async (tx) => {
        const updateData = {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
        };

        await workflowsOps.updateWorkflow(
          workflowId,
          updateData,
          workflowSteps,
          tx
        );
      });

      res.json({ message: "Workflow updated successfully", id: workflowId });
    } catch (error: any) {
      console.error("Error updating workflow:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: "Workflow not found" });
      } else {
        res.status(500).json({ error: "Failed to update workflow" });
      }
    }
  },
};

export default workflowHandlers;
