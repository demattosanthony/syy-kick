import { and, desc, eq, sql } from "drizzle-orm";
import {
  createIssueSchema,
  Issue,
  ISSUE_STATUS,
  issues,
  updateIssueSchema,
} from "./issues.schema";
import { PaginatedIssues } from "./issues.types";
import db from "../../config/db";
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
  }): Promise<PaginatedIssues> => {
    const conditions = [eq(issues.projectId, params.projectId)];

    if (params.status) {
      conditions.push(eq(issues.status, params.status));
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
   * Get a single issue by its ID.
   */
  getIssue: async ({
    issueId,
  }: {
    issueId: string;
  }): Promise<Issue | undefined> => {
    return await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      with: {
        creator: true,
        assignees: true,
        comments: true,
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

    const [newIssue] = await db
      .insert(issues)
      .values({
        projectId: validatedData.projectId,
        creatorId: validatedData.creatorId,
        title: validatedData.title,
        description: validatedData.description,
      })
      .returning({ id: issues.id });

    if (!newIssue) {
      throw new Error("Failed to create issue.");
    }
    return newIssue;
  },

  /**
   * Update an existing issue.
   */
  updateIssue: async ({
    issueId,
    data,
  }: {
    issueId: string;
    data: z.infer<typeof updateIssueSchema>;
  }): Promise<void> => {
    // Validate input data
    const validatedData = updateIssueSchema.parse(data);

    if (Object.keys(validatedData).length === 0) {
      // Nothing to update
      return;
    }

    await db.update(issues).set(validatedData).where(eq(issues.id, issueId));
  },

  /**
   * Delete an issue by its ID.
   * Note: Comments and Assignees referencing this issue will also be deleted due to cascading deletes defined in the schema.
   */
  deleteIssue: async ({ issueId }: { issueId: string }): Promise<void> => {
    await db.delete(issues).where(eq(issues.id, issueId));
  },
};
