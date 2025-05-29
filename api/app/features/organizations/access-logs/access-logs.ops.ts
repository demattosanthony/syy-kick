/** Config */
import db from "../../../config/db";

/** Schema */
import {
  accessLogs,
  actions,
  documents,
  knowledgeBases,
  organizations,
  resources,
  users,
} from "../../../config/schema";

/** Drizzle */
import { SQL } from "drizzle-orm/sql";
import { eq, ne, ilike, or, and, desc, sql } from "drizzle-orm";

export const ops = {
  async getAccessLogs(
    orgId: string,
    page = 1,
    limit = 10,
    filters: {
      search?: string;
      resource?: string;
      action?: string;
      status?: string;
    } = {}
  ) {
    const offset = (page - 1) * limit;

    const accessLogsResource = await db.query.resources.findFirst({
      where: eq(resources.name, "org_access_logs"),
    });

    if (!accessLogsResource) {
      throw new Error("Access logs resource not found");
    }

    const whereClause = [
      eq(accessLogs.organizationId, orgId),
      ne(accessLogs.resourceId, accessLogsResource.id),
    ];

    if (filters.resource && filters.resource !== "all") {
      const resource = await db.query.resources.findFirst({
        where: eq(resources.name, filters.resource),
      });

      if (!resource) {
        throw new Error("Resource not found");
      }

      whereClause.push(eq(accessLogs.resourceId, resource.id));
    }

    if (filters.action && filters.action !== "all") {
      const action = await db.query.actions.findFirst({
        where: eq(actions.name, filters.action),
      });

      if (!action) {
        throw new Error("Action not found");
      }

      whereClause.push(eq(accessLogs.actionId, action.id));
    }

    if (filters.status && filters.status !== "all") {
      whereClause.push(
        eq(accessLogs.status, filters.status as "authorized" | "unauthorized")
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      whereClause.push(
        or(
          ilike(users.name, `%${searchLower}%`),
          ilike(users.email, `%${searchLower}%`),
          ilike(organizations.name, `%${searchLower}%`),
          ilike(documents.name, `%${searchLower}%`),
          ilike(knowledgeBases.name, `%${searchLower}%`)
        ) as SQL<unknown>
      );
    }

    const [logs, count] = await Promise.all([
      db
        .select({
          id: accessLogs.id,
          status: accessLogs.status,
          createdAt: accessLogs.createdAt,
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            profilePicture: users.profilePicture,
          },
          action: {
            id: actions.id,
            name: actions.name,
          },
          resource: {
            id: resources.id,
            name: resources.name,
          },
          organization: {
            id: organizations.id,
            name: organizations.name,
          },
          document: {
            id: documents.id,
            name: documents.name,
          },
          knowledgeBase: {
            id: knowledgeBases.id,
            name: knowledgeBases.name,
          },
        })
        .from(accessLogs)
        .leftJoin(users, eq(accessLogs.userId, users.id))
        .leftJoin(
          organizations,
          eq(accessLogs.organizationId, organizations.id)
        )
        .leftJoin(actions, eq(accessLogs.actionId, actions.id))
        .leftJoin(resources, eq(accessLogs.resourceId, resources.id))
        .leftJoin(documents, eq(accessLogs.documentId, documents.id))
        .leftJoin(
          knowledgeBases,
          eq(accessLogs.knowledgeBaseId, knowledgeBases.id)
        )
        .where(and(...whereClause))
        .orderBy(desc(accessLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql`count(*)` })
        .from(accessLogs)
        .leftJoin(users, eq(accessLogs.userId, users.id))
        .leftJoin(
          organizations,
          eq(accessLogs.organizationId, organizations.id)
        )
        .leftJoin(documents, eq(accessLogs.documentId, documents.id))
        .leftJoin(
          knowledgeBases,
          eq(accessLogs.knowledgeBaseId, knowledgeBases.id)
        )
        .where(and(...whereClause)),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total: Number(count[0].count),
        pages: Math.ceil(Number(count[0].count) / limit),
      },
    };
  },
};
