import { eq, or, exists } from "drizzle-orm";
import {
  workflows,
  workflowOrganizations,
  workflowUsers,
} from "./workflows.schema";
import db from "../../config/db";

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
};
