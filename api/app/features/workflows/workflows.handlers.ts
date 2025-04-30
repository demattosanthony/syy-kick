import { Request, Response } from "express";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
} from "./workflows.registry";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const orgWorkflows = getAuthorizedWorkflowDefinitions(
        req.workspace?.id as string
      );
      res.json(orgWorkflows);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // const isAllowedtoAcess = isWorkflowAuthorized(
      //   id as any,
      //   req.workspace?.id as string
      // );
      // if (!isAllowedtoAcess) {
      //   res.status(403).json({ error: "Unauthorized" });
      //   return;
      // }

      const workflow = getWorkflowDefinition(id as any);

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
};

export default workflowHandlers;
