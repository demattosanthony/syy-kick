/** Drizzle */
import { eq, or, exists } from "drizzle-orm";

/** Schemas */
import {
  workflows,
  workflowOrganizations,
  workflowUsers,
  workflowSteps,
} from "./workflows.schema";

/** Database */
import db from "../../config/db";

/** Types */
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { WorkflowRunStep, WorkflowWithRelations } from "./workflows.types";
import { workflowsUtils } from "./workflows.utils";

export const workflowsOps = {
  getWorkflows: async ({
    orgId,
    userId,
  }: {
    orgId?: string;
    userId?: string;
  }) => {
    if (!orgId && !userId) {
      throw new Error("Either orgId or userId must be provided");
    }

    const orgWorkflows: WorkflowWithRelations[] =
      await db.query.workflows.findMany({
        where: or(
          orgId
            ? exists(
                db
                  .select()
                  .from(workflowOrganizations)
                  .where(
                    eq(workflowOrganizations.workflowId, workflows.id) &&
                      eq(workflowOrganizations.organizationId, orgId)
                  )
              )
            : undefined,
          userId
            ? exists(
                db
                  .select()
                  .from(workflowUsers)
                  .where(
                    eq(workflowUsers.workflowId, workflows.id) &&
                      eq(workflowUsers.userId, userId)
                  )
              )
            : undefined
        ),
        with: {
          steps: {
            with: {
              agent: true,
            },
            orderBy: (steps, { asc }) => [asc(steps.createdAt)],
          },
        },
      });

    return workflowsUtils.formatWorkflows(orgWorkflows);
  },

  getWorkflow: async (workflowId: string) => {
    const workflow: WorkflowWithRelations | undefined =
      await db.query.workflows.findFirst({
        where: eq(workflows.id, workflowId),
        with: {
          steps: {
            with: {
              agent: true,
            },
            orderBy: (steps, { asc }) => [asc(steps.createdAt)],
          },
          tags: true,
        },
      });

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    return workflowsUtils.formatWorkflow(workflow);
  },

  createWorkflow: async (
    userId: string,
    name: string,
    description: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<typeof workflows.$inferSelect> => {
    const [workflow] = await tx
      .insert(workflows)
      .values({
        name,
        description,
        createdBy: userId,
      })
      .returning();

    return workflow;
  },

  createWorkflowSteps: async (
    workflowId: string,
    steps: WorkflowRunStep[],
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    let previousStepId: string | null = null;
    let currentTimestamp = new Date();

    for (const step of steps) {
      const { id, ...stepData } = step;

      const baseValues = {
        workflowId,
        parentStepId: previousStepId,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      };

      const values = step.agentId
        ? {
            ...baseValues,
            agentId: step.agentId,
          }
        : {
            ...baseValues,
            ...stepData,
          };

      const [insertedStep] = (await tx
        .insert(workflowSteps)
        .values(values as any)
        .returning({ id: workflowSteps.id })) as [{ id: string }];

      if (!insertedStep) {
        throw new Error(
          `Failed to insert workflow step ${(step as any).name || "(unknown name)"}`
        );
      }

      previousStepId = insertedStep.id;
      currentTimestamp = new Date(currentTimestamp.getTime() + 1);
    }
  },

  createWorkflowOrganizationRelation: async (
    workflowId: string,
    organizationId: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    await tx.insert(workflowOrganizations).values({
      workflowId,
      organizationId,
    });
  },

  createWorkflowUserRelation: async (
    workflowId: string,
    userId: string,
    tx: NodePgDatabase<typeof import("../../config/schema")>
  ): Promise<void> => {
    await tx.insert(workflowUsers).values({
      workflowId,
      userId,
    });
  },
};
