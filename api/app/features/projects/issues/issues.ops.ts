import { and, desc, eq, ilike, max, or, sql } from "drizzle-orm";
import {
  createCommentSchema,
  createIssueSchema,
  Issue,
  ISSUE_STATUS,
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

    // Get total count for pagination metadata
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(issues)
      .where(and(...conditions));

    const totalCount = countResult.count || 0;

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
      // Assuming Issue type matches schema output; adjust if relations added
      data: issuesList as Issue[],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: totalCount > page * limit,
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
        assignees: true,
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
      // Decide on error handling: return, throw new Error, etc.
      throw new Error("Invalid issue number provided for update.");
    }

    // Validate input data
    const validatedData = updateIssueSchema.parse(data);

    if (Object.keys(validatedData).length === 0) {
      // Nothing to update
      return;
    }

    const updatePayload = {
      ...validatedData,
      updatedAt: new Date(),
    };

    await db
      .update(issues)
      .set(updatePayload)
      .where(
        and(
          eq(issues.projectId, projectId),
          eq(issues.issueNumber, issueNumber)
        )
      );
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
      // Decide on error handling: return, throw new Error, etc.
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

    // Optional: Verify the issue exists before adding a comment
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
