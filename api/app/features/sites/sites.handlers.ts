import { Request, Response } from "express";
import { sitesOps } from "./sites.ops";
import { PaginatedSites } from "./sites.types";
import { formatSites } from "./sites.utils";

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
  }
};
