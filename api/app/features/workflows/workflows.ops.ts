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
import { WorkflowRunStep } from "./workflows.types";

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

        const orgWorkflows = await db.query.workflows.findMany({
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
        });

        return orgWorkflows;
    },

    getWorkflow: async (workflowId: string) => {
        const workflow = await db.query.workflows.findFirst({
            where: eq(workflows.id, workflowId),
            with: {
                steps: {
                    with: {
                        agents: true,
                    },
                    orderBy: (steps, { asc }) => [asc(steps.createdAt)],
                },
                tags: true,
            },
        });
        return workflow;
    },

    createWorkflow: async (userId: string, name: string, description: string, tx: NodePgDatabase<typeof import('../../config/schema')>): Promise<typeof workflows.$inferSelect> => {
        const [workflow] = await tx.insert(workflows).values({
            name,
            description,
            createdBy: userId,
        }).returning();

        return workflow;
    },

    createWorkflowSteps: async (workflowId: string, steps: WorkflowRunStep[], tx: NodePgDatabase<typeof import('../../config/schema')>): Promise<void> => {
        let previousStepId: string | null = null;

        for (const step of steps) {
            const { id, ...stepData } = step;
            
            const values = step.agentId 
                ? {
                    workflowId,
                    parentStepId: previousStepId,
                    agentId: step.agentId
                }
                : {
                    workflowId,
                    parentStepId: previousStepId,
                    ...stepData
                };

            const [insertedStep] = await tx.insert(workflowSteps)
                .values(values)
                .returning() as [typeof workflowSteps.$inferSelect];

            previousStepId = insertedStep.id;
        }
    }
};
