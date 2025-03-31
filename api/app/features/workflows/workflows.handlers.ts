import { Request, Response } from "express";

import { streamText } from "ai";

import { MODELS } from "../models";
import { generateAttachmentData } from "../threads/threads.utils";
import {
  getWorkflowById,
  getWorkflowsForOrganization,
  isOrganizationAuthorized,
} from "./workflows.config";

import { Mistral } from "@mistralai/mistralai";
import { ExtendedAttachment } from "../threads/threads.types";

const mistral = new Mistral({
  apiKey: process.env["MISTRAL_API_KEY"] ?? "",
});

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      console.log("req.workspace?.id", req.workspace?.id);
      const orgWorkflows = getWorkflowsForOrganization(
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
      const isAllowedtoAcess = isOrganizationAuthorized(
        id as any,
        req.workspace?.id as string
      );
      if (!isAllowedtoAcess) {
        res.status(403).json({ error: "Unauthorized" });
        return;
      }

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

    const workflow = getWorkflowById(workflowId as any);
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

    const modelConfig = MODELS[workflow.modelName];
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

      // Base64 images collected from ocr of documents
      let images: string[] = [];

      for (const attachment of attachmentsData) {
        const result = await mistral.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            documentUrl: `data:application/pdf;base64,${attachment}`,
            type: "document_url",
          },
          includeImageBase64: true,
        });

        for (const item of result.pages) {
          item.images.forEach(async (image, index) => {
            if (!image.imageBase64) {
              return;
            }

            images.push(image.imageBase64);
          });
        }
      }

      console.log(`Images: ${images.length}`);

      const response = streamText({
        model: modelConfig.model,
        maxSteps: 10,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text" as const,
                text: workflow.prompt,
              },
              ...images.map((image) => ({
                type: "image" as const,
                mimeType: "image/jpeg",
                image: image,
              })),
            ],
          },
        ],
        providerOptions: {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 4_500 },
          },
          openai: {
            reasoningEffort: "medium",
          },
        },
        onError: (error) => {
          console.error("Error running workflow:", error);
          res.status(500).json({ error: "Failed to process workflow" });
        },
        // onStepFinish: async ({
        //   finishReason,
        //   text,
        //   toolCalls,
        //   toolResults,
        //   reasoning,
        // }) => {
        //   console.log("Tool calls:", toolCalls);
        //   console.log("Tool results:", toolResults.length);
        //   console.log("Finish reason:", finishReason);
        //   console.log("Text:", text);
        //   console.log("Reasoning:", reasoning);
        //   console.log("\n\n\n");
        // },
      });

      // Pipe the data out as SSE
      return response.pipeDataStreamToResponse(res, {
        sendReasoning: true,
      });
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },
};

export default workflowHandlers;
