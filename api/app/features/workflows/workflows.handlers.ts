import { Request, Response } from "express";
import { generateAttachmentData } from "../threads/threads.utils";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
  isWorkflowAuthorized,
} from "./workflows.registry";
import { WorkflowAttachment } from "./workflows.types";
// import { WorkflowRunner } from "./workflows.runnner";
import { FileData, ProgressUpdate } from "./workflows.schemas";
import db from "../../config/db";
import {
  messageAttachments,
  messages,
  threads,
  toolCalls as toolCallsTable,
} from "../../config/schema";
import { eq } from "drizzle-orm";
import { CONFIG } from "../../config/constants";

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

  // Using the ai sdk data stream protocol to send updates to the client: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
  run: async (req: Request, res: Response) => {
    req.setTimeout(0); // Disable the timeout for this long-running request

    const { threadId } = req.params;
    const { message, workflowId } = req.body;

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

    let keepAliveInterval: ReturnType<typeof setInterval> | null = null; // Keep track of the interval

    try {
      // Start keep-alive ping, need this in prod to prevent the connection from timing out
      keepAliveInterval = setInterval(() => {
        // Use the 2:[...] format for data messages as requested
        res.write('2:[{"type":"keepalive"}]\n');
      }, 25000); // Send every 25 seconds

      await db
        .update(threads)
        .set({
          title: `${workflow.name} Execution - ${new Date().toLocaleString()}`,
          updatedAt: new Date(),
        })
        .where(eq(threads.id, threadId as string));

      // Save the initial user message first
      const userMessage = await db
        .insert(messages)
        .values({
          userId: req.dbUser!.id,
          id: crypto.randomUUID(),
          threadId: threadId as string,
          role: "user",
          text: message.content || "",
          createdAt: new Date(),
        })
        .returning();

      // Save attachments if any
      let attachments: WorkflowAttachment[] = message.experimental_attachments;
      if (attachments?.length > 0) {
        await Promise.all(
          attachments.map((attachment) =>
            db.insert(messageAttachments).values({
              messageId: userMessage[0].id,
              fileName: attachment.name,
              mimeType: attachment.contentType,
              fileKey: attachment.file_key,
              type: attachment.contentType?.includes("image")
                ? "image"
                : "file",
            })
          )
        );
      }

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
              CONFIG.__prod__
            ),
          };
        })
      );

      const [assistantMessage] = await db
        .insert(messages)
        .values({
          userId: req.dbUser!.id,
          id: crypto.randomUUID(),
          threadId: threadId as string,
          role: "assistant",
          text: "Okay let me get started!\n\n",
          createdAt: new Date(),
        })
        .returning();

      const workflowProgressCallback = async (update: ProgressUpdate) => {
        if (update.type === "workflow_start") {
          res.write('0:"Okay let me get started!\\n\\n"\n');
        }

        if (update.type === "step_start") {
          const toolCallId = `step-${update.data.stepId}`;
          // Tool call start
          res.write(
            `b:{"toolCallId":"${toolCallId}","toolName":"workflow-step"}\n`
          );
          // Tool call with initial message
          res.write(
            `9:{"toolCallId":"${toolCallId}","toolName":"workflow-step","args":{"message":"${update.data.message}"}}\n`
          );

          // Attach the tool call to the initial assistant message
          await db.insert(toolCallsTable).values({
            id: crypto.randomUUID(),
            messageId: assistantMessage.id,
            toolName: "workflow-step",
            toolCallId: toolCallId,
            args: { message: update.data.message },
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        if (update.type === "step_complete") {
          const toolCallId = `step-${update.data.stepId}`;
          // Tool result with completion message
          res.write(
            `a:{"toolCallId":"${toolCallId}","result":"${update.data.message}"}\n`
          );

          // Update tool call status and result
          await db
            .update(toolCallsTable)
            .set({
              status: "completed",
              result: update.data.message,
              updatedAt: new Date(),
            })
            .where(eq(toolCallsTable.toolCallId, toolCallId));
        }

        if (update.type === "workflow_complete") {
          const escapedOutput = update.data.output
            .replace(/\\/g, "\\\\") // escape backslashes
            .replace(/"/g, '\\"') // escape quotes
            .replace(/\n/g, "\\n"); // escape newlines

          let finalMessage = "";
          // Check the workflow output type
          //           if (workflow.output.type === "text/csv") {
          //             res.write(
          //               `0:"<antThinking>Returning the artifact from the workflow run</antThinking>"\n`
          //             );
          //             res.write(
          //               `0:"<antArtifact identifier=\\"workflow-output\\" type=\\"application/vnd.ant.code\\" language=\\"csv\\" title=\\"${workflow.title} Output\\">${escapedOutput}</antArtifact>"\n`
          //             );
          //             finalMessage = `<antThinking>Returning the artifact from the workflow run</antThinking>

          // <antArtifact identifier="workflow-output" type="application/vnd.ant.code" language="csv" title="${workflow.title} Output">${update.data.output}</antArtifact>`;
          //           } else if (workflow.output.type === "text/markdown") {
          //             res.write(
          //               `0:"<antThinking>Returning the artifact from the workflow run</antThinking>"\n`
          //             );
          //             res.write(
          //               `0:"<antArtifact identifier=\\"workflow-output\\" type=\\"text/markdown\\" title=\\"${workflow.title} Output\\">${escapedOutput}</antArtifact>"\n`
          //             );
          //             finalMessage = `<antThinking>Returning the artifact from the workflow run</antThinking>

          // <antArtifact identifier="workflow-output" type="text/markdown" title="${workflow.title} Output">${update.data.output}</antArtifact>`;
          //           } else {
          //             res.write(`0:"${escapedOutput}"\n`);
          //           }

          // Save final assistant message with workflow output
          await db.insert(messages).values({
            userId: req.dbUser!.id,
            id: crypto.randomUUID(),
            threadId: threadId as string,
            role: "assistant",
            text: finalMessage,
            createdAt: new Date(),
          });
        }
      };

      //   const runnner = new WorkflowRunner(
      //     workflowId,
      //     processedAttachments,
      //     workflowProgressCallback,
      //     CONFIG.__prod__ ? false : true // Logging enabled in dev mode
      //   );

      //   await runnner.run();

      res.write(`d:{"finishReason":"stop"}\n`);
      res.end();
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    } finally {
      // Ensure the keep-alive interval is cleared
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
    }
  },
};

export default workflowHandlers;
