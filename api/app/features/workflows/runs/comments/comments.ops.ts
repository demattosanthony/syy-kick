/** Database */
import db from "../../../../config/db";
import { users } from "../../../../config/schema";

/** Mastra */
import client from "../../../../config/mastra-client";

/** Schema */
import { workflowRunComments, workflowRuns } from "../../workflows.schema";

/** Drizzle ORM */
import { eq, and, inArray } from "drizzle-orm";

/** Resend */
import { Resend } from "resend";

export const workflowRunCommentsOps = {
  createComment: async (
    workflowRunId: string,
    userId: string,
    comment: string
  ) => {
    const databaseWorkflowRun = await db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.mastraRunId, workflowRunId),
      with: {
        workflow: true,
      },
    });

    if (!databaseWorkflowRun) {
      throw new Error("Workflow run not found");
    }

    const admins = await db.query.users.findMany({
      where: inArray(users.email, [
        "anthony.demattos@setty.com",
        "quentinnippert@gmail.com",
      ]),
    });

    const [newComment] = await db
      .insert(workflowRunComments)
      .values({
        workflowRunId: databaseWorkflowRun.id,
        userId,
        comment,
      })
      .returning();

    if (admins.length > 0) {
      const workflow = client.getWorkflow(
        databaseWorkflowRun.workflow.mastraId
      );
      const run = await workflow.runs();
      const foundRun = run.runs.find(
        (run) => run.runId === databaseWorkflowRun.mastraRunId
      );

      if (!foundRun) {
        throw new Error("Workflow run not found");
      }

      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: "invitations@noreply.syyclops.com",
          to: admins.map((admin) => admin.email),
          subject: "New comment on workflow run",
          html: `
          <p>A new comment has been added to a workflow run.</p>
          <p>Workflow run: <a href="${process.env.FRONTEND_URL}/workflows/${databaseWorkflowRun.workflow.mastraId}/runs/${foundRun.runId}">${databaseWorkflowRun.id}</a></p>
          <p>Comment: ${comment}</p>
          `,
        });
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'email:", error);
        throw error;
      }
    }

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

  getComments: async (workflowRunId: string, userId: string) => {
    const databaseWorkflowRun = await db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.mastraRunId, workflowRunId),
    });

    if (!databaseWorkflowRun) {
      throw new Error("Workflow run not found");
    }

    const admins = await db.query.users.findMany({
      where: inArray(users.email, [
        "anthony.demattos@setty.com",
        "quentinnippert@gmail.com",
      ]),
    });

    const conditions = [
      eq(workflowRunComments.workflowRunId, databaseWorkflowRun.id),
    ];

    // If not an admin, add user condition
    if (!admins.some((admin) => admin.id === userId)) {
      conditions.push(eq(workflowRunComments.userId, userId));
    }

    const comments = await db.query.workflowRunComments.findMany({
      where: and(...conditions),
      with: {
        user: true,
      },
    });

    return comments;
  },
};
