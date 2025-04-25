
/** Config */
import db from "../../../config/db";

/** Drizzle */
import { eq, ne, and, or, ilike, desc, sql, SQL } from "drizzle-orm";

/** Schema */
import { accessLogs, users, organizations, knowledgeBases, actions, resources } from "../../../config/schema";

/** Types */
import { Permissions } from "../../permissions/permissions.types";
import { AccessLogStatus } from "../../organizations/organizations.types";

export const ops = {
    async listKnowledgeBaseAccessLogs(knowledgeBaseId: string, page: number, limit: number, filters: {
        search?: string;
        resource?: string;
        action?: string;
        status?: string;
    }) {
        const offset = (page - 1) * limit;

        const accessLogsResource = await db.query.resources.findFirst({
            where: eq(resources.name, Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS)
        });

        if (!accessLogsResource) {
            throw new Error("Access logs resource not found");
        }

        const whereClause = [
            eq(accessLogs.knowledgeBaseId, knowledgeBaseId),
            ne(accessLogs.resourceId, accessLogsResource.id)
        ];

        if (filters.resource && filters.resource !== "all") {
            const resource = await db.query.resources.findFirst({
                where: eq(resources.name, filters.resource)
            });

            if (!resource) {
                throw new Error("Resource not found");
            }

            whereClause.push(eq(accessLogs.resourceId, resource.id));
        }

        if (filters.action && filters.action !== "all") {
            const action = await db.query.actions.findFirst({
                where: eq(actions.name, filters.action)
            });

            if (!action) {
                throw new Error("Action not found");
            }

            whereClause.push(eq(accessLogs.actionId, action.id));
        }

        if (filters.status && filters.status !== "all") {
            whereClause.push(
                eq(accessLogs.status, filters.status as AccessLogStatus)
            );
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            whereClause.push(
                or(
                    ilike(users.name, `%${searchLower}%`),
                    ilike(users.email, `%${searchLower}%`),
                    ilike(knowledgeBases.name, `%${searchLower}%`),
                ) as SQL<unknown>
            );
        }

        const [logs, count] = await Promise.all([
            db.select({
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
                knowledgeBase: {
                    id: knowledgeBases.id,
                    name: knowledgeBases.name,
                }
            })
                .from(accessLogs)
                .leftJoin(users, eq(accessLogs.userId, users.id))
                .leftJoin(organizations, eq(accessLogs.organizationId, organizations.id))
                .leftJoin(knowledgeBases, eq(accessLogs.knowledgeBaseId, knowledgeBases.id))
                .leftJoin(actions, eq(accessLogs.actionId, actions.id))
                .leftJoin(resources, eq(accessLogs.resourceId, resources.id))
                .where(and(...whereClause))
                .orderBy(desc(accessLogs.createdAt))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql`count(*)` })
                .from(accessLogs)
                .leftJoin(users, eq(accessLogs.userId, users.id))
                .leftJoin(organizations, eq(accessLogs.organizationId, organizations.id))
                .leftJoin(knowledgeBases, eq(accessLogs.knowledgeBaseId, knowledgeBases.id))
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
    }
}