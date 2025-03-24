import z from "zod";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import db from "../../config/db";
import { PermissionManager } from "../permissions/permissions.tools";
import { PaginatedSites, Site, SiteData } from "./sites.types";
import { formatSites, validationSchema } from "./sites.utils";
import { sites } from "./sites.schema";
import { projects } from "../../config/schema";

export const sitesOps = {
  getAllSites: async (params: {
    userId: string;
    organizationId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedSites> => {
    if (!params.organizationId && !params.userId) {
      throw new Error("Either organizationId or userId must be provided");
    }

    let conditions = [];

    if (params.organizationId && params.userId) {
      const sitesIds = await PermissionManager.getUserSitesIds(
        params.userId,
        params.organizationId
      );
      conditions.push(inArray(sites.id, sitesIds));
    } else if (params.userId) {
      conditions.push(eq(sites.userId, params.userId));
    }

    if (params.search) {
      conditions.push(
        or(
          ilike(sites.name, `%${params.search}%`),
          ilike(sites.address, `%${params.search}%`),
          ilike(sites.city, `%${params.search}%`)
        )
      );
    }

    // Set default pagination values
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    // Get total count for pagination metadata
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sites)
      .where(and(...conditions));

    const totalCount = countResult.count || 0;

    // Get sites
    const sitesList = await db.query.sites.findMany({
      where: and(...conditions),
      orderBy: (sites, { desc }) => [desc(sites.createdAt)],
      limit,
      offset,
    });

    return {
      data: formatSites(sitesList),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: totalCount > page * limit,
      },
    };
  },

  getSite: async ({
    siteId,
  }: {
    siteId: string;
  }): Promise<Site | undefined> => {
    return await db.query.sites.findFirst({
      where: eq(sites.id, siteId),
    });
  },

  createSite: async ({
    data,
    organizationId,
    userId,
  }: {
    data: z.infer<typeof validationSchema.create>;
    organizationId?: string;
    userId?: string;
  }): Promise<void> => {
    const siteData = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      address: data.address.address,
      city: data.address.city,
      state: data.address.state,
      postalCode: data.address.postalCode,
      country: data.address.country,
      placeId: data.address.placeId,
      latitude: data.address.latitude?.toString() ?? null,
      longitude: data.address.longitude?.toString() ?? null,
      organizationId,
      userId,
    };

    await db.insert(sites).values(siteData);
  },

  updateSite: async ({
    siteId,
    data,
  }: {
    siteId: string;
    data: z.infer<typeof validationSchema.update>;
  }): Promise<void> => {
    const siteUpdates = {
      name: data.name,
      description: data.description,
      address: data.address.address,
      city: data.address.city,
      state: data.address.state,
      postalCode: data.address.postalCode,
      country: data.address.country,
      placeId: data.address.placeId,
      latitude: data.address.latitude?.toString() ?? null,
      longitude: data.address.longitude?.toString() ?? null,
    };

    await db.update(sites).set(siteUpdates).where(eq(sites.id, siteId));
  },

  deleteSite: async ({ siteId }: { siteId: string }): Promise<void> => {
    await db.delete(sites).where(eq(sites.id, siteId));
  },

  linkProjects: async ({
    siteId,
    projectsIds,
  }: {
    siteId: string;
    projectsIds: string[];
  }) => {
    await db
      .update(projects)
      .set({
        siteId: siteId,
      })
      .where(inArray(projects.id, projectsIds));
  },
};
