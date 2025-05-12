import { GetVNextWorkflowResponse, MastraClient } from "@mastra/client-js";
import db from "../../config/db";
import { eq, exists, or } from "drizzle-orm";
import { workflowOrganizations, workflows, workflowUsers } from "./workflows.schema";
import client from "./workflows.mastra.client";

export const workflowsMastraOps = {
    getWorkflows: async (userId: string, organizationId?: string) => {

        const conditions = [
            exists(
                db.select({ id: workflowUsers.id }).from(workflowUsers).where(eq(workflowUsers.userId, userId))
            ),
        ];

        if (organizationId) {
            conditions.push(
                exists(
                    db.select({ id: workflowOrganizations.id }).from(workflowOrganizations).where(eq(workflowOrganizations.organizationId, organizationId))
                )
            );
        }

        try {
            const userWorkflows = await db.query.workflows.findMany({
                where: or(
                    ...conditions
                ),
                columns: {
                    mastraId: true,
                }
            });

            const mastraIds = userWorkflows.map(userWorkflow => userWorkflow.mastraId);

            console.log(mastraIds, '<--- mastraIds');

            const workflows: Record<string, GetVNextWorkflowResponse> = await client.getVNextWorkflows();

            console.log(workflows, '<--- workflows');

            console.log(Object.keys(workflows), '<--- Object.keys(workflows)');

            const response = [];

            for (const [key, value] of Object.entries(workflows)) {
                if (mastraIds.includes(key)) {
                    response.push(value);
                }
            }

            return response;
        } catch (error: any) {
            console.error("Error getting workflows:", error?.message);
            throw error;
        }
    },
    getWorkflow: async (workflowId: string, userId: string, organizationId?: string) => {

        const exists = await db.query.workflows.findFirst({
            where: eq(workflows.mastraId, workflowId)
        });

        if (!exists) {
            throw new Error("Workflow not found");
        }

        const conditions = [
            eq(workflowUsers.userId, userId),
        ];

        if (organizationId) {
            conditions.push(eq(workflowOrganizations.organizationId, organizationId));
        }

        const userHasAccess = await db.query.workflowUsers.findFirst({
            where: or(
                ...conditions
            )
        });

        if (!userHasAccess) {
            throw new Error("User does not have access to workflow");
        }

        const workflow: GetVNextWorkflowResponse = await client.getVNextWorkflow(workflowId).details();

        return workflow;
    },
}