import { Request, Response } from "express";
import { workflowRunsOps } from "./runs.ops";

export const workflowsRunsHandlers = {
  createRun: async (req: Request, res: Response) => {
    const { workflowId, input } = req.body;

    if(!req.dbUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await workflowRunsOps.createRun(workflowId, req.dbUser.id, input);

    res.status(201).json({
      message: "Run created successfully",
    });
  }
};
