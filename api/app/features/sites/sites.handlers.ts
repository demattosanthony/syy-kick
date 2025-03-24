import { Request, Response } from "express";
import { sitesOps } from "./sites.ops";
import { PaginatedSites, Site, SiteData } from "./sites.types";
import { validationSchema } from "./sites.utils";
import { z } from "zod";

export const siteHandlers = {
  list: async (req: Request, res: Response) => {
    const sites = await sitesOps.getAllSites({
      userId: req.dbUser!.id,
      organizationId: req.workspace!.id,
      search: req.query.search as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
    });

    res.json(sites as PaginatedSites);
  },

  get: async (req: Request, res: Response) => {
    const site = await sitesOps.getSite({
      siteId: req.params.id,
    });

    res.json(site);
  },

  create: async (req: Request, res: Response) => {
    const identifiers: {
      organizationId?: string;
      userId?: string;
    } = {};

    if (
      req.workspace?.type === "organization" &&
      req.body.type === "organization"
    ) {
      if (req.body.organizationId) {
        identifiers.organizationId = req.body.organizationId;
      } else {
        identifiers.organizationId = req.workspace.id;
      }
    } else {
      identifiers.userId = req.dbUser!.id;
    }

    await sitesOps.createSite({
      data: req.body as z.infer<typeof validationSchema.create>,
      ...identifiers,
    });

    res.status(201).json({
      message: "Site created successfully",
    });
  },

  update: async (req: Request, res: Response) => {
    await sitesOps.updateSite({
      siteId: req.params.id,
      data: req.body as z.infer<typeof validationSchema.update>,
    });

    res.status(202).json({
      message: "Site updated successfully",
    });
  },

  delete: async (req: Request, res: Response) => {
    await sitesOps.deleteSite({
      siteId: req.params.id,
    });

    res.status(204).json({
      message: "Site deleted successfully",
    });
  },

  linkProjects: async (req: Request, res: Response) => {
    await sitesOps.linkProjects({
      siteId: req.params.siteId,
      projectsIds: req.body.projectsIds,
    });
  },
};
