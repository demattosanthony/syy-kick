import { GetVNextWorkflowResponse } from "@mastra/client-js";
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

            const workflows: Record<string, GetVNextWorkflowResponse> = await client.getVNextWorkflows();

            const response: Record<string, GetVNextWorkflowResponse> = {};
            Object.entries(workflows).forEach(([key, value]) => {
                if (mastraIds.includes(key)) {
                    response[key] = value;
                }
            });

            return response;
        } catch (error: any) {
            console.error("Error getting workflows:", error?.message);
            throw error;
        }
    },
    getWorkflow: async (workflowId: string, userId: string, organizationId?: string) => {

        const workflowExists = await db.query.workflows.findFirst({
            where: eq(workflows.mastraId, workflowId)
        });

        if (!workflowExists) {
            throw new Error("Workflow not found");
        }

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

        const userHasAccess = await db.query.workflows.findFirst({
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