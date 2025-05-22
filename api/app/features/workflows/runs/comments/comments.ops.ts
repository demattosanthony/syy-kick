/** Database */
import db from "../../../../config/db";

/** Schema */
import { workflowRunComments, workflowRuns, workflowOrganizations } from "../../workflows.schema";

/** Drizzle ORM */
import { eq, and } from "drizzle-orm";

export const workflowRunCommentsOps = {
    createComment: async (workflowRunId: string, userId: string, comment: string) => {

        const databaseWorkflowRun = await db.query.workflowRuns.findFirst({
            where: eq(workflowRuns.mastraRunId, workflowRunId),
        });

        if (!databaseWorkflowRun) {
            throw new Error("Workflow run not found");
        }

        const [newComment] = await db
            .insert(workflowRunComments)
            .values({
                workflowRunId: databaseWorkflowRun.id,
                userId,
                comment,
            })
            .returning();
        return newComment;
    },

    updateComment: async (commentId: string, userId: string, comment: string) => {
        const [updatedComment] = await db
            .update(workflowRunComments)
            .set({ comment })
            .where(
                and(
                    eq(workflowRunComments.id, commentId),
                    eq(workflowRunComments.userId, userId)
                )
            )
            .returning();
        return updatedComment;
    },

    deleteComment: async (commentId: string, userId: string) => {
        const [deletedComment] = await db
            .delete(workflowRunComments)
            .where(
                and(
                    eq(workflowRunComments.id, commentId),
                    eq(workflowRunComments.userId, userId)
                )
            )
            .returning();
        return deletedComment;
    },

    getComments: async (workflowRunId: string, organizationId: string) => {
        const databaseWorkflowRun = await db.query.workflowRuns.findFirst({
            where: eq(workflowRuns.mastraRunId, workflowRunId),
        });

        if (!databaseWorkflowRun) {
            throw new Error("Workflow run not found");
        }

        const comments = await db.query.workflowRunComments.findMany({
            where: eq(workflowRunComments.workflowRunId, databaseWorkflowRun.id),
            with: {
                user: true,
            },
        });

        return comments;
    },
};
