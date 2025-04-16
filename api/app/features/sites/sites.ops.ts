import z from "zod";
import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import db from "../../config/db";
import { PermissionManager } from "../permissions/permissions.tools";
import { PaginatedSites, Site } from "./sites.types";
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
          ilike(sites.address, `%${params.search}%`),
          ilike(sites.city, `%${params.search}%`),
          ilike(sites.state, `%${params.search}%`),
          ilike(sites.postalCode, `%${params.search}%`),
          ilike(sites.country, `%${params.search}%`)
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
  }): Promise<Site> => {
    const siteData = {
      address: data.address,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      placeId: data.placeId,
      latitude: data.latitude?.toString() ?? null,
      longitude: data.longitude?.toString() ?? null,
      organizationId,
      userId,
    };

    const [site] = await db.insert(sites).values(siteData).returning();

    return site;
  },

  siteExists: async ({
    siteId,
    userId,
    organizationId,
    placeId,
    address,
    postalCode,
    city,
  }: {
    siteId?: string;
    userId?: string;
    organizationId?: string;
    placeId?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  }): Promise<Site | undefined> => {
    const conditions = [];

    if (siteId) {
      conditions.push(ne(sites.id, siteId));
    }

    if (userId) {
      conditions.push(eq(sites.userId, userId));
    }

    if (organizationId) {
      conditions.push(eq(sites.organizationId, organizationId));
    }

    if (placeId) {
      conditions.push(eq(sites.placeId, placeId));
    }

    if (address && postalCode && city) {
      conditions.push(
        and(
          eq(sites.address, address),
          eq(sites.postalCode, postalCode),
          eq(sites.city, city)
        )
      );
    }

    const site = await db.query.sites.findFirst({
      where: and(...conditions),
    });

    return site;
  },
};
