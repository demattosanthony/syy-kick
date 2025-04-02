import { Request, Response } from "express";
import { generateAttachmentData } from "../threads/threads.utils";
import { ExtendedAttachment } from "../threads/threads.types";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
  isWorkflowAuthorized,
} from "./workflows.registry";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      console.log("req.workspace?.id", req.workspace?.id);
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
      const isAllowedtoAcess = isWorkflowAuthorized(
        id as any,
        req.workspace?.id as string
      );
      if (!isAllowedtoAcess) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

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

  run: async (req: Request, res: Response) => {
    const { workflowId } = req.params;
    const { message } = req.body;

    const workflow = getWorkflowDefinition(workflowId as any);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    // SSE Setup
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders();

    const attachments: ExtendedAttachment[] = message.experimental_attachments;

    try {
      const attachmentsData = await Promise.all(
        attachments.map(async (attachment: any) => {
          return generateAttachmentData(
            attachment.file_key,
            "application/pdf",
            true
          );
        })
      );
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },
};

export default workflowHandlers;
