import { Request, Response } from "express";
import { generateAttachmentData } from "../threads/threads.utils";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
  isWorkflowAuthorized,
} from "./workflows.registry";
import { WorkflowAttachment } from "./workflows.types";
import { WorkflowRunner } from "./workflows.runnner";
import { FileData } from "./workflows.schemas";

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
    res.setHeader("x-vercel-ai-data-stream", "v1");
    res.flushHeaders();

    let attachments: WorkflowAttachment[] = message.experimental_attachments;

    try {
      // Convert array to record structure matching FileData schema
      const processedAttachments: Record<string, FileData> = {};

      await Promise.all(
        attachments.map(async (attachment) => {
          processedAttachments[attachment.inputId] = {
            fileName: attachment.name || "",
            mimeType: attachment.contentType || "application/pdf",
            url: await generateAttachmentData(
              attachment.file_key,
              attachment.contentType || "application/pdf",
              true
            ),
          };
        })
      );

      const runnner = new WorkflowRunner(
        workflowId,
        processedAttachments,
        (update) => {
          if (update.type === "workflow_start") {
            res.write('0:"Okay let me get started!\\n\\n"\n');
          }

          if (update.type === "step_start") {
            res.write(
              `0:"I am starting the step ${update.data.stepId}\\n\\n"\n`
            );
          }

          if (update.type === "step_complete") {
            res.write(
              `0:"I am done with the step ${update.data.stepId}\\n\\n"\n`
            );
          }

          if (update.type === "workflow_complete") {
            const escapedOutput = update.data.output
              .replace(/\\/g, "\\\\") // escape backslashes
              .replace(/"/g, '\\"') // escape quotes
              .replace(/\n/g, "\\n"); // escape newlines

            res.write(
              `0:"<antThinking>Returning the artifact from the workflow run</antThinking>"\n`
            );
            res.write(
              `0:"<antArtifact identifier=\\"workflow-output\\" type=\\"application/vnd.ant.code\\" language=\\"csv\\" title=\\"Workflow Output\\">${escapedOutput}</antArtifact>"\n`
            );
          }
        },
        true
      );

      await runnner.run();

      res.write(`d:{"finishReason":"stop"}\n`);

      res.end();
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },
};

export default workflowHandlers;
