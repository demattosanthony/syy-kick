import { Request, Response } from "express";

import { generateText, streamText, tool } from "ai";
import { z } from "zod";

import { MODELS } from "../models";
import {
  createProjectSearchTool,
  generateAttachmentData,
} from "../threads/threads.utils";
import db from "../../config/db";
import { workflows, workflowEdges, workflowNodes } from "../../config/schema";
import { desc, eq } from "drizzle-orm";
import workflowSchemas from "./workflows.schemas";
import exa from "../../config/exa";
import s3 from "../../config/s3";

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
    const { message } = req.body;

    console.log("message:", message);

    const modelConfig = MODELS["claude-3.7-sonnet-thinking"];

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
          content: `You are an experienced business analyst tasked with evaluating a Request for Proposal (RFP) for a new project. Your goal is to determine whether pursuing this project is worthwhile based on specific criteria. You work at Setty & Associates.

# Setty & Associates Overview
Setty & Associates, established in 1984, is a family-owned, multidisciplinary design engineering firm specializing in mechanical, electrical, plumbing, and fire protection (MEP/FP) engineering services. Their expertise encompasses commissioning, energy services, and sustainable design, aiming to deliver high-performing, energy-efficient buildings. ​

The firm has contributed to various notable projects, including the DC Public Schools' COVID-19 retrofits, the University of Maryland's Brendan Iribe Center for Computer Science and Innovation, and D.C. United Soccer's Audi Stadium.

Headquartered in Fairfax, Virginia, Setty & Associates operates multiple offices across the United States, including locations in Atlanta, Baltimore, Charlottesville, Los Angeles, New York, Philadelphia, Riverside, Tampa, and Washington, D.C.

Their integrated approach combines HVAC, mechanical, electrical, plumbing, and fire protection engineering skills with in-depth knowledge of building design and environmental best practices

As a Minority Business Enterprise (MBE) and Small Business Enterprise (SBE), Setty & Associates is committed to diversity and inclusion within the engineering industry. 
      
# SETTY WIN/NO WIN EVALUATION FORM

## Project Information

| Field                      | Value |
| -------------------------- | ----- |
| Project Name               |       |
| Project Location           |       |
| Client                     |       |
| Project Budget             |       |
| Potential Team Members     |       |
| Identified Decision Makers |       |
| Anticipated Completion     |       |
| Market Segment             |       |

## Evaluation Criteria

| Criteria                                 | Score |
| ---------------------------------------- | ----- |
| Knowledge of project before RFP          |       |
| Relationship with client/decision makers |       |
| Knowledge of project goals/drivers       |       |
| Availability of qualified staff          |       |
| Expertise with project type              |       |
| Experience relevative to Competition     |       |
| Working Experience of Proposed Team      |       |
| Profitability Likelihood                 |       |
| History / Comfort Level with Location    |       |
| Potential for Future Work                |       |
| **Total Score**                          |       |

## Scoring Legend

| Score | Description |
| ----- | ----------- |
| 1     | None        |
| 2     | Low         |
| 3     | OK          |
| 4     | Good        |
| 5     | Excellent   |

## Evaluation Results

| Range      | Outcome                         |
| ---------- | ------------------------------- |
| >40 Points | Winnable                        |
| 34 - 39    | Possible/Needs Selling          |
| <34        | Not Winnable / Worth the effort |

## Notes

Mitigating Circumstances/Thoughts on effort necessary to win/Perceived probability:

## Market Segments

Aviation & Transportation
Community & Cultural
Defense & Aerospace
Higher Education
K-12
Healthcare & Wellness
Hospitality
Laboratories
Libraries
Mission Critical
Mixed Use
Public Safety
Religious
Residential & Housing
Retail
Stadium & Arena
Term (Fed-State-Local Gov)
Workplace

# Instructions

You take these steps to evaluate the RFP:
1. Review and analyze the RFP document. Extract the key information and requirements.
2. Evaluate the project information and evaluation criteria.
3. Score the evaluation criteria based on the information you have.
4. Determine the total score and evaluate the outcome based on the scoring legend.
5. Write down any notes or thoughts on the effort necessary to win the project.
6. Determine the market segment the project falls under.
7. Provide csv artifact with the evaluation results.

Your final response to the user is a csv artifact with the evaluation results.

<artifacts_info>
Artifacts are for self contained content that users will modify or reuse, displayed in a separate UI window for clarity.

<artifact_instructions>
  When creating the artifact you follow these steps:

  1. Wrap the content in opening and closing \`<antArtifact>\` tags.
  2. Assign an identifier to the \`identifier\` attribute of the opening \`<antArtifact>\` tag. For updates, reuse the prior identifier. For new artifacts, the identifier should be descriptive and relevant to the content, using kebab-case (e.g., "example-code-snippet"). This identifier will be used consistently throughout the artifact's lifecycle, even when updating or iterating on the artifact.
  3. Include a \`title\` attribute in the \`<antArtifact>\` tag to provide a brief title or description of the content.
  4. Add a \`type\` attribute to the opening \`<antArtifact>\` tag to specify the type of content the artifact represents. Since you are always creating a csv artifact the type should be"
    - type="application/vnd.ant.code" language="csv"
</artifact_instructions>

Here is a template of what the csv artifact result should look like:

<example_artifact>
   <user_query>Evaluate this RFP</user_query>

   <assistant_response>
      Based on my analysis, here are the results:


        <antArtifact identifier="evaluation-results" type="application/vnd.ant.code" language="csv" title="RFP Evaluation Results" />
            Project Information
            Project Name,Dulles International Airport
            Project Location,Washington, D.C.
            Client,Washington Metropolitan Airports Authority
            Project Budget,"$500,000,000"
            Potential Team Members,Clark Construction, HOK, Gensler
            Identified Decision Makers,John Smith, Jane Doe
            Anticipated Completion,January 2025
            Market Segment,Aviation & Transportation

            Evaluation Criteria
            Knowledge of project before RFP,3
            Relationship with client/decision makers,4
            Knowledge of project goals/drivers,5
            Availability of qualified staff,4
            Expertise with project type,5
            Experience relevative to Competition,4
            Working Experience of Proposed Team,2
            Profitability Likelihood,3
            History / Comfort Level with Location,4
            Potential for Future Work,5
            Total Score,39

            Notes
            (note_1)
            (note_2)
            (note_3)
        </antArtifact>
    </assistant_response>
</example_artifact>
</artifacts_info>

Ensure all your math is correct before creating the evaluation results artifact.`,
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
              text: "Evaulate this RFP.",
            },
          ],
        },
      ],
      providerOptions: {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 32_000 },
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
