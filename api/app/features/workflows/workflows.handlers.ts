import { Request, Response } from "express";

import { generateText, tool } from "ai";
import { z } from "zod";

import { MODELS } from "../models";
import { createProjectSearchTool } from "../threads/threads.utils";
import db from "../../config/db";
import { workflows, workflowEdges, workflowNodes } from "../../config/schema";
import { desc, eq } from "drizzle-orm";
import workflowSchemas from "./workflows.schemas";
import exa from "../../config/exa";

const workflowHandlers = {
  getAll: async (req: Request, res: Response) => {
    try {
      const allWorkflows = await db.query.workflows.findMany({
        orderBy: desc(workflows.createdAt),
      });
      res.json(allWorkflows);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const { name } = workflowSchemas.create.parse(req.body);
      const [workflow] = await db
        .insert(workflows)
        .values({ name })
        .returning();
      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getById: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const workflow = await db.query.workflows.findFirst({
        where: (workflows, { eq }) => eq(workflows.id, id),
        with: {
          nodes: true,
          edges: true,
        },
      });

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

  update: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const { name } = workflowSchemas.update.parse(req.body);

      await db
        .update(workflows)
        .set({ name, updatedAt: new Date() })
        .where(eq(workflows.id, id));

      const updatedWorkflow = await db.query.workflows.findFirst({
        where: (workflows, { eq }) => eq(workflows.id, id),
      });

      if (!updatedWorkflow) {
        res.status(404).json({ error: "Workflow not found" });
        return;
      }

      res.json(updatedWorkflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  },

  delete: async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // Use transaction to ensure all related data is deleted
      await db.transaction(async (tx) => {
        await tx.delete(workflowEdges).where(eq(workflowEdges.workflowId, id));
        await tx.delete(workflowNodes).where(eq(workflowNodes.workflowId, id));
        await tx.delete(workflows).where(eq(workflows.id, id));
      });

      res.json({ message: "Workflow deleted" });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  nodes: {
    create: async (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        const nodeData = workflowSchemas.node.create.parse(req.body);

        // Check if workflow exists
        const workflow = await db.query.workflows.findFirst({
          where: (workflows, { eq }) => eq(workflows.id, id),
        });

        if (!workflow) {
          res.status(404).json({ error: "Workflow not found" });
          return;
        }

        const [node] = await db
          .insert(workflowNodes)
          .values({
            workflowId: id,
            type: nodeData.type,
            positionX: nodeData.positionX,
            positionY: nodeData.positionY,
            config: nodeData.config,
          })
          .returning();

        res.json({ node });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    },

    update: async (req: Request, res: Response) => {
      const { workflowId, nodeId } = req.params;

      try {
        const nodeData = workflowSchemas.node.update.parse(req.body);

        // Check if node exists and belongs to the workflow
        const existingNode = await db.query.workflowNodes.findFirst({
          where: (nodes, { eq, and }) =>
            and(eq(nodes.id, nodeId), eq(nodes.workflowId, workflowId)),
        });

        if (!existingNode) {
          res.status(404).json({ error: "Node not found" });
          return;
        }

        const [updatedNode] = await db
          .update(workflowNodes)
          .set({
            type: nodeData.type ?? existingNode.type,
            positionX: nodeData.positionX ?? existingNode.positionX,
            positionY: nodeData.positionY ?? existingNode.positionY,
            config: nodeData.config ?? existingNode.config,
          })
          .where(eq(workflowNodes.id, nodeId))
          .returning();

        res.json({ node: updatedNode });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    },

    delete: async (req: Request, res: Response) => {
      const { workflowId, nodeId } = req.params;

      try {
        // Delete related edges first
        await db.transaction(async (tx) => {
          await tx
            .delete(workflowEdges)
            .where(
              eq(workflowEdges.workflowId, workflowId) &&
                (eq(workflowEdges.sourceNodeId, nodeId) ||
                  eq(workflowEdges.targetNodeId, nodeId))
            );

          await tx
            .delete(workflowNodes)
            .where(
              eq(workflowNodes.workflowId, workflowId) &&
                eq(workflowNodes.id, nodeId)
            );
        });

        res.json({ message: "Node deleted" });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  },

  edges: {
    create: async (req: Request, res: Response) => {
      const { id } = req.params;

      try {
        const edgeData = workflowSchemas.edge.create.parse(req.body);

        // Verify that both nodes exist and belong to this workflow
        const [sourceNode, targetNode] = await Promise.all([
          db.query.workflowNodes.findFirst({
            where: (nodes, { eq, and }) =>
              and(
                eq(nodes.id, edgeData.sourceNodeId),
                eq(nodes.workflowId, id)
              ),
          }),
          db.query.workflowNodes.findFirst({
            where: (nodes, { eq, and }) =>
              and(
                eq(nodes.id, edgeData.targetNodeId),
                eq(nodes.workflowId, id)
              ),
          }),
        ]);

        if (!sourceNode || !targetNode) {
          res.status(400).json({ error: "Source or target node not found" });
          return;
        }

        const [edge] = await db
          .insert(workflowEdges)
          .values({
            workflowId: id,
            sourceNodeId: edgeData.sourceNodeId,
            targetNodeId: edgeData.targetNodeId,
          })
          .returning();

        res.json({ edge });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    },

    delete: async (req: Request, res: Response) => {
      const { workflowId, edgeId } = req.params;

      try {
        await db
          .delete(workflowEdges)
          .where(
            eq(workflowEdges.workflowId, workflowId) &&
              eq(workflowEdges.id, edgeId)
          );

        res.json({ message: "Edge deleted" });
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    },
  },

  run: async (req: Request, res: Response) => {
    const prompt = req.body.message;

    console.log("Prompt:", prompt);

    const modelConfig = MODELS["gpt-4o"];

    const response = await generateText({
      model: modelConfig.model,
      maxSteps: 10,
      tools: {
        project_search_tool: createProjectSearchTool(
          "470c92ea-6560-4884-9c17-6d0114f663d7",
          modelConfig
        ),
        web_search_tool: tool({
          description: "A tool for searching the web",
          parameters: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            const results = await exa.search(query);
            return results;
          },
        }),
        web_scrape_tool: tool({
          description: "A tool for scraping the web",
          parameters: z.object({ url: z.string() }),
          execute: async ({ url }) => {
            const response = await fetch(
              `https://r.jina.ai/${encodeURIComponent(url)}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.JINA_API_KEY}`,
                },
              }
            );
            const data = await response.text();
            console.log(data);
            return data;
          },
        }),
      },
      prompt,
      system: `You are a Mechanical QA QC building engineer for a certain project. Your job is to review mechanical drwaings and plans and analyze if anything is not done properly. Todays date is ${new Date().toLocaleDateString()}.`,
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

    res.json({ message: "Workflow started" });
  },
};

export default workflowHandlers;
