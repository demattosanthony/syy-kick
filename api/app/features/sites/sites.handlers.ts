import { Request, Response } from "express";
import { sitesOps } from "./sites.ops";
import { PaginatedSites, Site, SiteData } from "./sites.types";
import { formatSites, validationSchema } from "./sites.utils";
import { z } from "zod";

export const siteHandlers = {
  list: async (req: Request, res: Response) => {
    const sites = await sitesOps.getAllSites({
      userId: req.dbUser!.id,
      organizationId: req.workspace?.type === "organization" ? req.workspace!.id : undefined,
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

    if (!site) {
      res.status(404).json({
        message: "Site not found",
      });
      return;
    }

    const [formattedSite] = formatSites([site]);

    res.json(formattedSite);
  },

  create: async (req: Request, res: Response) => {
    const identifiers: {
      organizationId?: string;
      userId?: string;
    } = {};

    if (
      req.body.type === "organization" // User may create the site from workspace switcher
    ) {
      if (req.body.organizationId) {
        identifiers.organizationId = req.body.organizationId;
      } else if (req.workspace) {
        identifiers.organizationId = req.workspace.id;
      }
    } else {
      identifiers.userId = req.dbUser!.id;
    }

    const siteExists = await sitesOps.siteExists({
      placeId: req.body.address.placeId,
      address: req.body.address.address,
      postalCode: req.body.address.postalCode,
      city: req.body.address.city,
      ...identifiers,
    });

    if (siteExists) {
      res.status(400).json({
        message: "Site with the same address already exists",
      });
      return;
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

    const identifiers: {
      organizationId?: string;
      userId?: string;
    } = {};

    if (req.workspace?.type === "organization") {
      identifiers.organizationId = req.workspace.id;
    } else {
      identifiers.userId = req.dbUser!.id;
    }

    const siteExists = await sitesOps.siteExists({
      siteId: req.params.id,
      placeId: req.body.address.placeId,
      address: req.body.address.address,
      postalCode: req.body.address.postalCode,
      city: req.body.address.city,
      ...identifiers,
    });

    if (siteExists) {
      res.status(400).json({
        message: "Site with the same address already exists",
      });
      return;
    }

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

    res.status(202).json({
      message: "Site deleted successfully",
    });
  },

  linkProjects: async (req: Request, res: Response) => {
    await sitesOps.linkProjects({
      siteId: req.params.id,
      projectsIds: req.body.projectsIds,
    });

    res.status(202).json({
      message: "Projects linked successfully",
    });
  },
};
