import { and, desc, eq, ilike, max, or, sql } from "drizzle-orm";
import {
  createCommentSchema,
  createIssueSchema,
  Issue,
  ISSUE_STATUS,
  issueAssignees,
  issueComments,
  issues,
  updateCommentSchema,
  updateIssueSchema,
} from "./issues.schema";
import { PaginatedIssues } from "./issues.types";
import db from "../../../config/db";
import { z } from "zod";

export const issueOps = {
  /**
   * Get a paginated list of issues for a specific project.
   */
  getAllIssues: async (params: {
    projectId: string;
    status?: (typeof ISSUE_STATUS)[number];
    page?: number;
    limit?: number;
    searchTerm?: string;
  }): Promise<PaginatedIssues> => {
    const conditions = [eq(issues.projectId, params.projectId)];

    if (params.status) {
      conditions.push(eq(issues.status, params.status));
    }

    // Add search condition if searchTerm is provided
    if (params.searchTerm && params.searchTerm.trim() !== "") {
      const searchPattern = `%${params.searchTerm.trim()}%`;
      conditions.push(
        or(
          ilike(issues.title, searchPattern),
          // Use sql`coalesce` to handle potentially null descriptions
          ilike(sql`coalesce(${issues.description}, '')`, searchPattern)
        )!
      );
    }

    // Set default pagination values
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    // Perform counts concurrently
    const [countResult, openCountResult, closedCountResult] = await Promise.all(
      [
        // Get total count for pagination metadata based on current filters
        db
          .select({ count: sql<number>`count(*)` })
          .from(issues)
          .where(and(...conditions)),
        // Get total open count for the project
        db
          .select({ count: sql<number>`count(*)` })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, params.projectId),
              eq(issues.status, "open")
            )
          ),
        // Get total closed count for the project
        db
          .select({ count: sql<number>`count(*)` })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, params.projectId),
              eq(issues.status, "closed")
            )
          ),
      ]
    );

    const totalCount = countResult[0]?.count || 0;
    const totalOpen = openCountResult[0]?.count || 0;
    const totalClosed = closedCountResult[0]?.count || 0;

    // Get issues
    const issuesList = await db.query.issues.findMany({
      where: and(...conditions),
      orderBy: [desc(issues.createdAt)],
      limit,
      offset,
      with: {
        creator: true,
        assignees: true,
      },
    });

    return {
      data: issuesList as Issue[],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: totalCount > page * limit,
        totalOpen,
        totalClosed,
      },
    };
  },

  /**
   * Get a single issue by its project ID and issue number.
   */
  getIssue: async ({
    projectId,
    issueNumber,
  }: {
    projectId: string;
    issueNumber: number;
  }): Promise<Issue | undefined> => {
    // Validate input - ensure issueNumber is a positive integer
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      console.error("Invalid issue number provided:", issueNumber);
      return undefined; // Or throw an error
    }

    return await db.query.issues.findFirst({
      where: and(
        eq(issues.projectId, projectId),
        eq(issues.issueNumber, issueNumber)
      ),
      with: {
        creator: true,
        assignees: {
          with: {
            user: true,
          },
        },
        comments: {
          with: {
            author: true,
          },
        },
      },
    });
  },

  /**
   * Create a new issue.
   */
  createIssue: async ({
    data,
  }: {
    data: z.infer<typeof createIssueSchema>;
  }): Promise<{ id: string }> => {
    // Validate input data
    const validatedData = createIssueSchema.parse(data);

    const maxIssueNumberResult = await db
      .select({ maxIssueNumber: max(issues.issueNumber) })
      .from(issues)
      .where(eq(issues.projectId, validatedData.projectId));

    const nextIssueNumber = (maxIssueNumberResult[0]?.maxIssueNumber || 0) + 1;

    const [newIssue] = await db
      .insert(issues)
      .values({
        projectId: validatedData.projectId,
        creatorId: validatedData.creatorId,
        title: validatedData.title,
        description: validatedData.description,
        issueNumber: nextIssueNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: issues.id });

    if (!newIssue) {
      throw new Error("Failed to create issue.");
    }

    // Handle assignees
    if (validatedData.assignees && validatedData.assignees.length > 0) {
      await db.insert(issueAssignees).values(
        validatedData.assignees.map((userId) => ({
          issueId: newIssue.id,
          userId: userId,
          assignedAt: new Date(),
        }))
      );
    }

    return newIssue;
  },

  /**
   * Update an existing issue identified by project ID and issue number.
   */
  updateIssue: async ({
    projectId,
    issueNumber,
    data,
  }: {
    projectId: string;
    issueNumber: number;
    data: z.infer<typeof updateIssueSchema>;
  }): Promise<void> => {
    // Validate input - ensure issueNumber is a positive integer
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      console.error("Invalid issue number provided for update:", issueNumber);
      throw new Error("Invalid issue number provided for update.");
    }

    // Validate input data
    const validatedData = updateIssueSchema.parse(data);
    const { assignees: newAssignees, ...issueUpdateData } = validatedData;

    if (Object.keys(issueUpdateData).length === 0 && !newAssignees) {
      // Nothing to update
      return;
    }

    // Fetch the issue first to get its ID for assignee updates
    const issue = await db.query.issues.findFirst({
      where: and(
        eq(issues.projectId, projectId),
        eq(issues.issueNumber, issueNumber)
      ),
      columns: {
        id: true,
      },
    });

    if (!issue) {
      throw new Error("Issue not found for update.");
    }

    const updatePayload = {
      ...issueUpdateData,
      updatedAt: new Date(),
    };

    await db.transaction(async (tx) => {
      if (Object.keys(issueUpdateData).length > 0) {
        await tx
          .update(issues)
          .set(updatePayload)
          .where(eq(issues.id, issue.id)); // Use issue ID for update
      }

      // Handle assignees update
      if (newAssignees !== undefined) {
        // Delete existing assignees for this issue
        await tx
          .delete(issueAssignees)
          .where(eq(issueAssignees.issueId, issue.id));

        // Insert new assignees if any are provided
        if (newAssignees.length > 0) {
          await tx.insert(issueAssignees).values(
            newAssignees.map((userId) => ({
              issueId: issue.id,
              userId: userId,
              assignedAt: new Date(),
            }))
          );
        }
      }
    });
  },

  /**
   * Delete an issue by its project ID and issue number.
   * Note: Comments and Assignees referencing this issue will also be deleted due to cascading deletes defined in the schema.
   */
  deleteIssue: async ({
    projectId,
    issueNumber,
  }: {
    projectId: string;
    issueNumber: number;
  }): Promise<void> => {
    // Validate input - ensure issueNumber is a positive integer
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      console.error("Invalid issue number provided for delete:", issueNumber);
      throw new Error("Invalid issue number provided for delete.");
    }

    await db
      .delete(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          eq(issues.issueNumber, issueNumber)
        )
      );
  },

  // --- Comment Operations ---

  /**
   * Create a new comment on an issue.
   */
  createComment: async ({
    data,
  }: {
    data: z.infer<typeof createCommentSchema>;
  }): Promise<{ id: string }> => {
    const validatedData = createCommentSchema.parse(data);

    const issueExists = await db.query.issues.findFirst({
      where: eq(issues.id, validatedData.issueId),
      columns: { id: true },
    });

    if (!issueExists) {
      throw new Error("Issue not found.");
    }

    const [newComment] = await db
      .insert(issueComments)
      .values({
        ...validatedData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: issueComments.id });

    if (!newComment) {
      throw new Error("Failed to create comment.");
    }
    return newComment;
  },

  /**
   * Update an existing comment.
   */
  updateComment: async ({
    commentId,
    data,
  }: {
    commentId: string;
    data: z.infer<typeof updateCommentSchema>;
  }): Promise<void> => {
    const validatedData = updateCommentSchema.parse(data);

    if (!validatedData.comment || validatedData.comment.trim() === "") {
      throw new Error("Comment content cannot be empty.");
    }

    await db
      .update(issueComments)
      .set({
        comment: validatedData.comment,
        updatedAt: new Date(),
      })
      .where(eq(issueComments.id, commentId));
  },

  /**
   * Delete a comment by its ID.
   */
  deleteComment: async ({
    commentId,
  }: {
    commentId: string;
  }): Promise<void> => {
    await db.delete(issueComments).where(eq(issueComments.id, commentId));
  },
};
