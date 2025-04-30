import { Request, Response } from "express";
import {
  getAuthorizedWorkflowDefinitions,
  getWorkflowDefinition,
  isWorkflowAuthorized,
} from "./workflows.registry";
import {
  WorkflowAttachment,
  WorkflowExecutionInputValue,
  WorkflowProgressCallback,
} from "./workflows.types";
import db from "../../config/db";
import {
  messageAttachments,
  messages,
  threads,
  toolCalls as toolCallsTable,
} from "../../config/schema";
import { eq } from "drizzle-orm";
import { CONFIG } from "../../config/constants";
import { WorkflowRunner } from "./workflows.runner";
import s3 from "../../config/s3";

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
      const workflowInputValues: Record<string, WorkflowExecutionInputValue> =
        {};

      await Promise.all(
        attachments.map(async (attachment) => {
          const fileData = new Uint8Array(
            await s3.file(attachment.file_key).arrayBuffer()
          );

          workflowInputValues[attachment.inputId] = {
            filename: attachment.name || "",
            mimeType: attachment.contentType || "application/pdf",
            data: fileData,
          };
        })
      );

      const workflowProgressCallback: WorkflowProgressCallback = async (
        update
      ) => {
        if (update.type === "agent_step") {
          const text = update.data.text;
          const toolCalls = update.data.toolCalls;
          const toolResults = update.data.toolResults;
          const finishReason = update.data.finishReason;
          const usage = update.data.usage;

          // Stringify and escape the text content for safe embedding
          const escapedText = JSON.stringify(text).slice(1, -1); // remove surrounding quotes from stringify
          res.write(`0:"${escapedText}"\n`);

          const [assistantMessage] = await db
            .insert(messages)
            .values({
              userId: req.dbUser!.id,
              id: crypto.randomUUID(),
              threadId: threadId as string,
              role: "assistant",
              text: text,
              createdAt: new Date(),
            })
            .returning();

          for (const toolCall of toolCalls) {
            // Stringify args and escape the resulting string for embedding
            const stringifiedArgs = JSON.stringify(toolCall.args);
            res.write(
              `9:{"toolCallId":"${toolCall.toolCallId}","toolName":"${
                toolCall.toolName
              }","args":${stringifiedArgs}}\n`
            );

            // Attach the tool call to the initial assistant message
            await db.insert(toolCallsTable).values({
              id: crypto.randomUUID(),
              messageId: assistantMessage.id,
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              args: toolCall.args,
              status: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          for (const toolResult of toolResults) {
            // Stringify result and escape the resulting string for embedding
            const stringifiedResult = JSON.stringify(toolResult.result);
            res.write(
              `a:{"toolCallId":"${toolResult.toolCallId}","result":${stringifiedResult}}\n`
            );

            // Update tool call status and result
            await db
              .update(toolCallsTable)
              .set({
                status: "completed",
                result: toolResult.result,
                updatedAt: new Date(),
              })
              .where(eq(toolCallsTable.toolCallId, toolResult.toolCallId));
          }
        }
      };

      const runnner = new WorkflowRunner(
        workflow,
        workflowProgressCallback,
        CONFIG.__prod__ ? false : true // Logging enabled in dev mode
      );

      await runnner.run(workflowInputValues);

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
