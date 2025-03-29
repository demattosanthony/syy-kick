import z from "zod";
import { and, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import db from "../../config/db";
import { PermissionManager } from "../permissions/permissions.tools";
import { PaginatedSites, Site, SiteData } from "./sites.types";
import { formatSites, validationSchema } from "./sites.utils";
import { sites } from "./sites.schema";
import { documents, projects } from "../../config/schema";
import { slugify } from "../../utils";
import s3 from "../../config/s3";
import { accessLogs } from "../../config/schema";

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
      slug: slugify(data.name),
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
      name: data.name ?? sites.name,
      slug: slugify(data.name ?? sites.name),
      description: data.description ?? sites.description,
      address: data.address.address ?? sites.address,
      city: data.address.city ?? sites.city,
      state: data.address.state ?? sites.state,
      postalCode: data.address.postalCode ?? sites.postalCode,
      country: data.address.country ?? sites.country,
      placeId: data.address.placeId ?? sites.placeId,
      latitude: data.address.latitude ? data.address.latitude.toString() : null,
      longitude: data.address.longitude
        ? data.address.longitude.toString()
        : null,
    };

    await db.update(sites).set(siteUpdates).where(eq(sites.id, siteId));
  },

  deleteSite: async ({ siteId }: { siteId: string }): Promise<void> => {
    const projectsIds = await db.query.projects.findMany({
      where: eq(projects.siteId, siteId),
      columns: {
        id: true,
      }
    }).then((projects) => projects.map((project) => project.id));

    const fileKeys = await db.query.documents.findMany({
      where: inArray(documents.projectId, projectsIds),
      columns: {
        fileKey: true,
      },
    }).then((docs) => docs.map((doc) => doc.fileKey));

    for (const fileKey of fileKeys) {
      if (fileKey) {
        await s3.delete(fileKey);
      }
    }

    // Delete all documents and the project from the database
    await db.delete(documents).where(inArray(documents.projectId, projectsIds));
    await db.delete(projects).where(inArray(projects.id, projectsIds));

    // Delete the site from the database
    await db.delete(sites).where(eq(sites.id, siteId));
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
  }): Promise<boolean> => {
    const conditions = [];

    if (siteId) {
      conditions.push(ne(sites.id, siteId));
    }

    if (userId) {
      conditions.push(eq(sites.userId, userId))
    }

    if (organizationId) {
      conditions.push(eq(sites.organizationId, organizationId))
    }

    if (placeId) {
      conditions.push(eq(sites.placeId, placeId));
    }

    if (address && postalCode && city) {
      conditions.push(and(eq(sites.address, address), eq(sites.postalCode, postalCode), eq(sites.city, city)));
    }

    const site = await db.query.sites.findFirst({
      where: and(...conditions),
    });

    return !!site;
  },

  // Temporary
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
