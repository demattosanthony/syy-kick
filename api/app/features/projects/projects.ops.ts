import { z } from "zod";
import { schemas } from "./projects.schemas";
import db from "../../config/db";
import { accessLogs, documents, organizations, projects, sites } from "../../config/schema";
import { and, asc, desc, eq, ilike, inArray, SQL, sql } from "drizzle-orm";
import { slugify } from "../../utils";
import { PermissionManager } from "../permissions/permissions.tools";
import PermissionsFactory from "../permissions/permissions.factory";
import s3 from "../../config/s3";
import { SortOption } from "./projects.types";
import { formatSites } from "../sites/sites.utils";

export const projectsOps = {
    createProject: async (data: z.infer<typeof schemas.createProject>, userId: string) => {
        // Check organization exists if organizationId is provided
        if (data.organizationId) {
            const org = await db.query.organizations.findFirst({
                where: eq(organizations.id, data.organizationId),
            });
            if (!org) {
                throw new Error("Organization not found");
            }
        }

        return await db.transaction(async (tx) => {
            const newProject = await db
                .insert(projects)
                .values({
                    name: data.name,
                    slug: slugify(data.name),
                    description: data.description,
                    projectNumber: data.project_number,
                    estimatedStartDate: data.estimated_start_date
                        ? new Date(data.estimated_start_date)
                        : null,
                    estimatedEndDate: data.estimated_end_date
                        ? new Date(data.estimated_end_date)
                        : null,
                    organizationId: data.organizationId,
                    userId: data.organizationId ? null : userId,
                    visibility: "private",
                    siteId: data.siteId,
                })
                .returning()
                .then((res) => res[0]);

            if (data?.organizationId) {
                const orgRoleAndResources =
                    await PermissionManager.getOrgRoleResourcesPermissions(
                        userId,
                        data.organizationId
                    );

                await PermissionsFactory.addProjectsAccess(
                    userId,
                    [newProject.id],
                    data.organizationId,
                    orgRoleAndResources.role.id,
                    orgRoleAndResources.resources
                );
            }

            return newProject;
        });
    },

    deleteProject: async (projectId: string) => {
        // Get all documents associated with this project
        const docs = await db.query.documents.findMany({
            where: eq(documents.projectId, projectId),
        });

        // Delete all files from S3
        for (const doc of docs) {
            if (doc.fileKey) {
                await s3.delete(doc.fileKey);
            }
        }

        // Delete all documents and the project from the database
        await db.delete(documents).where(eq(documents.projectId, projectId));
        await db.delete(projects).where(eq(projects.id, projectId));
    },

    listProjects: async (params: {
        siteId: string;
        organizationId?: string;
        userId?: string;
        search?: string;
        page?: number;
        limit?: number;
        sort?: SortOption;
    }) => {
        if (!params.organizationId && !params.userId) {
            throw new Error("Either organizationId or userId must be provided");
        }

        // Pagination
        const page = params.page || 1;
        const limit = params.limit || 10;
        const offset = (page - 1) * limit;

        const conditions = [];

        if (params.organizationId && params.userId) {
            const orgProjectsIds = await PermissionManager.getUserOrgProjectsIds(
                params.userId,
                params.organizationId
            );
            conditions.push(inArray(projects.id, orgProjectsIds));
        } else if (params.userId) {
            conditions.push(eq(projects.userId, params.userId));
        }

        if (params.siteId) {
            conditions.push(eq(projects.siteId, params.siteId));
        }

        if (params.search) {
            conditions.push(
                sql`(
                ${ilike(projects.name, `%${params.search}%`)} 
                OR 
                ${ilike(projects.projectNumber, `%${params.search}%`)}
              )`
            );
        }

        if (params.sort === "recent" && params.userId) {
            return await projectsOps.getPaginatedRecentProjects({
                page: params.page,
                limit: params.limit,
                conditions,
            });
        }

        let orderBy: Array<SQL> = [];
        if (params.sort) {
            switch (params.sort) {
                case SortOption.NAME_ASC:
                    orderBy = [asc(projects.name)];
                    break;
                case SortOption.NAME_DESC:
                    orderBy = [desc(projects.name)];
                    break;
                case SortOption.CREATED_ASC:
                    orderBy = [asc(projects.createdAt)];
                    break;
                case SortOption.CREATED_DESC:
                    orderBy = [desc(projects.createdAt)];
                    break;
                case SortOption.RECENT: // fallback
                    orderBy = [desc(projects.createdAt)];
                    break;
                default:
                    break;
            }
        }

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(projects)
            .where(and(...conditions));
        const totalCount = countResult[0]?.count || 0;

        const projs = await db.query.projects.findMany({
            where: and(...conditions),
            orderBy,
            limit,
            offset,
            with: {
                site: true,
            },
        });

        return {
            data: projs.map((p) => {
                const site = p.site ? formatSites([p.site]) : null;

                if (!site) {
                    return p;
                }

                return {
                    ...p,
                    site: site[0],
                };
            }),
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: page * limit < totalCount,
            },
        };
    },

    getPaginatedRecentProjects: async (params: {
        page?: number;
        limit?: number;
        conditions?: Array<SQL>;
    }) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const offset = (page - 1) * limit;

        const [totalCountResult] = await db
            .select({
                totalCount: sql<number>`COUNT(DISTINCT ${projects.id})`,
            })
            .from(projects)
            .leftJoin(accessLogs, eq(accessLogs.projectId, projects.id))
            .where(and(...(params.conditions ?? [])));
        const totalCount = totalCountResult?.totalCount ?? 0;

        const projs = await db
            .select({
                id: projects.id,
                name: projects.name,
                description: projects.description,
                slug: projects.slug,
                projectNumber: projects.projectNumber,
                visibility: projects.visibility,
                estimatedStartDate: projects.estimatedStartDate,
                estimatedEndDate: projects.estimatedEndDate,
                address: projects.address,
                city: projects.city,
                state: projects.state,
                country: projects.country,
                postalCode: projects.postalCode,
                latitude: projects.latitude,
                longitude: projects.longitude,
                siteId: projects.siteId,
                organizationId: projects.organizationId,
                userId: projects.userId,
                createdAt: projects.createdAt,
                updatedAt: projects.updatedAt,
                lastAccess: sql`MAX(${accessLogs.createdAt})`.as("lastAccess"),
                site: sites,
            })
            .from(projects)
            .leftJoin(accessLogs, eq(accessLogs.projectId, projects.id))
            .leftJoin(sites, eq(sites.id, projects.siteId))
            .where(and(...(params.conditions ?? [])))
            .groupBy(projects.id, sites.id)
            .orderBy(sql`MAX(${accessLogs.createdAt}) DESC NULLS LAST`)
            .limit(limit)
            .offset(offset);

        return {
            data: projs.map((p) => {
                const site = p.site ? formatSites([p.site]) : null;

                if (!site) {
                    return p;
                }

                return {
                    ...p,
                    site: site[0],
                };
            }),
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasMore: page * limit < totalCount,
            },
        };
    },

    getProject: async (projectId: string) => {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            with: {
                organization: {
                    with: {
                        members: true,
                    },
                },
                user: true,
                site: true,
            },
        });

        if (!project) {
            throw new Error("Project not found");
        }

        // Add logo presigned URL if organization has a logo
        if (project.organization?.logo) {
            (project.organization as any).logoUrl = await s3.presign(
                project.organization.logo,
                {
                    expiresIn: 60 * 60, // 1 hour
                }
            );
        }

        return project;
    },

    getProjectOrThrow: async (projectId: string) => {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });
        if (!project) {
            throw new Error("Project not found");
        }
        return project;
    },

    updateProject: async (projectId: string, data: z.infer<typeof schemas.updateProject>) => {
        const project = await projectsOps.getProjectOrThrow(projectId);

        const updatedProject = await db
            .update(projects)
            .set({
                name: data.name || project.name,
                slug: data.name ? slugify(data.name) : project.slug,
                description: data.description ?? project.description,
                projectNumber: data.project_number ?? project.projectNumber,
                estimatedStartDate: data.estimated_start_date
                    ? new Date(data.estimated_start_date)
                    : null,
                estimatedEndDate: data.estimated_end_date
                    ? new Date(data.estimated_end_date)
                    : null,
                siteId: data.siteId || project.siteId,
            })
            .where(eq(projects.id, projectId))
            .returning()
            .then((res) => res[0]);

        return updatedProject;
    }
}