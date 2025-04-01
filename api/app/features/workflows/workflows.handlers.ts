import { Request, Response } from "express";

import { generateObject, streamText } from "ai";
import { z } from "zod";

import { mistralAi, MODELS } from "../models";
import { generateAttachmentData } from "../threads/threads.utils";
import {
  getWorkflowById,
  getWorkflowsForOrganization,
  isOrganizationAuthorized,
} from "./workflows.config";

import { ExtendedAttachment } from "../threads/threads.types";

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

      // Step 1: Perform OCR on all attachments and collect images
      const extractedImages: string[] = [];
      for (const attachment of attachmentsData) {
        const result = await mistralAi.ocr.process({
          model: "mistral-ocr-latest",
          document: {
            documentUrl: `data:application/pdf;base64,${attachment}`,
            type: "document_url",
          },
          includeImageBase64: true,
        });

        console.log("OCR Result", result.pages.length);

        // Collect all valid images with base64 data
        for (const page of result.pages) {
          for (const image of page.images) {
            if (image.imageBase64) {
              extractedImages.push(image.imageBase64);
            }
          }
        }
      }

      console.log(`Total extracted images: ${extractedImages.length}`);

      // Step 2: Process relevancy checks in parallel
      //       if (extractedImages.length > 0) {
      //         const relevancyChecks = extractedImages.map((imageBase64) =>
      //           generateObject({
      //             model: MODELS["gemini-2.0-flash"].model,
      //             schema: z.object({
      //               isRelevant: z.boolean(),
      //             }),
      //             messages: [
      //               {
      //                 role: "user",
      //                 content: [
      //                   {
      //                     type: "text",
      //                     text: `You are an AI assistant tasked with determining whether an image is relevant to a given workflow. You will be provided with a description of a workflow and an image. Your job is to analyze the image and decide if it is relevant to the described workflow.

      // First, here is the description of the workflow:
      // <workflow_description>
      // Identify which areas HVAC equipment serves using contract mechanical drawings. The primary source of information is the mechanical schedules within these drawings. If service areas are not listed in the schedules, use the floorplans to determine equipment locations and ductwork paths. The final output is a table listing HVAC equipment IDs alongside their corresponding service areas.
      // Identify HVAC equipment service areas using contract mechanical drawings, prioritizing mechanical schedules within the drawings as the primary source.
      // </workflow_description>

      // Remember to be thorough in your analysis and clear in your reasoning. Your decision should be well-supported by your analysis and reasoning.`,
      //                   },
      //                   {
      //                     type: "image",
      //                     mimeType: "image/jpeg",
      //                     image: imageBase64,
      //                   },
      //                 ],
      //               },
      //             ],
      //           })
      //         );

      //         const results = await Promise.all(relevancyChecks);

      //         // Filter images based on relevancy
      //         for (let i = 0; i < extractedImages.length; i++) {
      //           console.log(
      //             `Image ${i + 1} relevancy:`,
      //             results[i].object.isRelevant
      //           );
      //           // Note: Original logic adds images when they are NOT relevant
      //           // Consider changing this condi  ion if that wasn't intended
      //           if (!results[i].object.isRelevant) {
      //             images.push(extractedImages[i]);
      //           }
      //         }
      //       }

      console.log(`Images after relevancy filtering: ${images.length}`);

      const response = streamText({
        model: modelConfig.model,
        maxSteps: 10,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: [
              ...extractedImages.map((image) => ({
                type: "image" as const,
                mimeType: "image/jpeg",
                image: image,
              })),
              {
                type: "text" as const,
                text: workflow.prompt,
              },
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
    } catch (error) {
      console.error("Error running workflow:", error);
      res.status(500).json({ error: "Failed to process workflow" });
    }
  },
};

export default workflowHandlers;
