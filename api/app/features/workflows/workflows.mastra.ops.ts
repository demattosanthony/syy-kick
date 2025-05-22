import { GetVNextWorkflowResponse } from "@mastra/client-js";
import db from "../../config/db";
import { eq, exists, or, and } from "drizzle-orm";
import {
  workflowOrganizations,
  workflows,
  workflowUsers,
  Tag,
} from "./workflows.schema";
import client from "./workflows.mastra.client";

export const workflowsMastraOps = {
  getWorkflows: async (userId: string, organizationId?: string) => {
    const conditions = [
      exists(
        db
          .select({ id: workflowUsers.id })
          .from(workflowUsers)
          .where(
            and(
              eq(workflowUsers.userId, userId),
              eq(workflowUsers.workflowId, workflows.id)
            )
          )
      ),
    ];

    if (organizationId) {
      conditions.push(
        exists(
          db
            .select({ id: workflowOrganizations.id })
            .from(workflowOrganizations)
            .where(
              and(
                eq(workflowOrganizations.organizationId, organizationId),
                eq(workflowOrganizations.workflowId, workflows.id)
              )
            )
        )
      );
    }

    try {
      const userWorkflows = await db.query.workflows.findMany({
        where: or(...conditions),
        columns: {
          mastraId: true,
          description: true,
        },
        with: {
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      const mastraIds = userWorkflows.map(
        (userWorkflow) => userWorkflow.mastraId
      );

      const workflows: Record<string, GetVNextWorkflowResponse> =
        await client.getVNextWorkflows();

      // Create a map of mastraId to database workflow data for easy lookup
      const dbWorkflowMap = new Map(
        userWorkflows.map((workflow) => [
          workflow.mastraId,
          {
            description: workflow.description,
            tags: workflow.tags.map((wt) => wt.tag),
          },
        ])
      );

      const response: Record<
        string,
        GetVNextWorkflowResponse & {
          description?: string | null;
          tags: Tag[];
        }
      > = {};

      Object.entries(workflows).forEach(([key, value]) => {
        if (mastraIds.includes(key)) {
          const dbData = dbWorkflowMap.get(key);
          response[key] = {
            ...value,
            description: dbData?.description,
            tags: dbData?.tags || [],
          };
        }
      });

      return response;
    } catch (error: any) {
      console.error("Error getting workflows:", error?.message);
      throw error;
    }
  },

  getWorkflow: async (
    workflowId: string,
    userId: string,
    organizationId?: string
  ) => {
    const workflowExists = await db.query.workflows.findFirst({
      where: eq(workflows.mastraId, workflowId),
      columns: {
        mastraId: true,
        description: true,
      },
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!workflowExists) {
      throw new Error("Workflow not found");
    }

    const conditions = [
      exists(
        db
          .select({ id: workflowUsers.id })
          .from(workflowUsers)
          .where(eq(workflowUsers.userId, userId))
      ),
    ];

    if (organizationId) {
      conditions.push(
        exists(
          db
            .select({ id: workflowOrganizations.id })
            .from(workflowOrganizations)
            .where(eq(workflowOrganizations.organizationId, organizationId))
        )
      );
    }

    const userHasAccess = await db.query.workflows.findFirst({
      where: or(...conditions),
    });

    if (!userHasAccess) {
      throw new Error("User does not have access to workflow");
    }

    const workflow: GetVNextWorkflowResponse = await client
      .getVNextWorkflow(workflowId)
      .details();

    // Merge with database data
    return {
      ...workflow,
      description: workflowExists.description,
      tags: workflowExists.tags.map((wt) => wt.tag),
    };
  },
};
