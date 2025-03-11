import { Request, Response } from "express";

import { streamText } from "ai";

import { MODELS } from "../models";
import { generateAttachmentData } from "../threads/threads.utils";
import { getWorkflowById, workflows } from "./workflows.config";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const workflow = getWorkflowById(id as any);

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

    console.log("workflowId:", workflowId);
    console.log("message:", message);

    console.log("message:", message);

    const workflow = getWorkflowById(workflowId as any);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    console.log("Running workflow:", workflow.title);

    const modelConfig = MODELS[workflow.modelName];

    const attachments = message.experimental_attachments;
    const attachment = attachments[0];

    const attachmentData = await generateAttachmentData(
      attachment.file_key,
      "application/pdf",
      true
    );

    const response = streamText({
      model: modelConfig.model,
      maxSteps: 10,
      messages: [
        {
          role: "system",
          content: workflow.systemMessage,
        },
        {
          role: "user",
          content: [
            {
              type: "file",
              mimeType: "application/pdf",
              data: attachmentData,
            },
            {
              type: "text",
              text: workflow.prompt,
            },
          ],
        },
      ],
      providerOptions: {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 6_000 },
        },
      },
      onStepFinish: async ({
        finishReason,
        text,
        toolCalls,
        toolResults,
        reasoning,
      }) => {
        console.log("Tool calls:", toolCalls);
        console.log("Tool results:", toolResults.length);
        console.log("Finish reason:", finishReason);
        console.log("Text:", text);
        console.log("Reasoning:", reasoning);
        console.log("\n\n\n");
      },
    });

    // Pipe the data out as SSE
    return response.pipeDataStreamToResponse(res, {
      sendReasoning: true,
    });
  },
};

export default workflowHandlers;
