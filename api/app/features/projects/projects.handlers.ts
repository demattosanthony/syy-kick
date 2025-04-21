import { Request, Response } from "express";
import { schemas } from "./projects.schemas";
import { projectsOps } from "./projects.ops";
import { getOrgIdOrUnedfined } from "../../utils";
import { SortOption } from "./projects.types";
import { sitesOps } from "../sites/sites.ops";

export const handlers = {
  createProject: async (req: Request, res: Response) => {
    const orgId = getOrgIdOrUnedfined(req.workspace);
    const data = {
      ...req.body,
      userId: !req.body.organizationId ? req.dbUser?.id : undefined,
      organizationId: req.body.organizationId ? orgId : undefined,
    };

    if (!req.dbUser?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.body.siteId && !req.body.address && !req.body.postalCode && !req.body.city && !req.body.state && !req.body.country) {
      res.status(400).json({ error: "Please select a site or provide a location" });
      return;
    }

    // Check if site exists, if not create it
    if (!req.body.siteId) {
      const site = await sitesOps.siteExists({
        userId: !req.body.organizationId ? req.dbUser?.id : undefined,
        organizationId: req.body.organizationId ? orgId : undefined,
        placeId: req.body.placeId,
        address: req.body.address,
        postalCode: req.body.postalCode,
        city: req.body.city,
      });

      if (site) {
        data.siteId = site.id;
      } else {
        const newSite = await sitesOps.createSite({
          data: {
            address: req.body.address,
            city: req.body.city,
            state: req.body.state,
            postalCode: req.body.postalCode,
            country: req.body.country,
            placeId: req.body.placeId,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
          },
          organizationId: req.body.organizationId ? orgId : undefined,
          userId: !req.body.organizationId ? req.dbUser?.id : undefined,
        });

        data.siteId = newSite.id;
      }
    }

    const validatedData = schemas.createProject.parse(data);
    const project = await projectsOps.createProject(
      validatedData,
      req.dbUser?.id
    );

    res.json(project);
  },

  listProjects: async (req: Request, res: Response) => {
    const { search, page, limit, siteId, sort } = req.query;

    const orgId = getOrgIdOrUnedfined(req.workspace);
    try {
      const projectsList = await projectsOps.listProjects({
        siteId: siteId as string,
        organizationId: orgId,
        userId: req.dbUser?.id,
        search: search as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        sort: sort as SortOption,
      });
      res.json(projectsList);
    } catch (error: any) {
      res.status(error.code || 500).json({ error: error.message });
    }
  },

  getProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const project = await projectsOps.getProject(projectId);
    res.json(project || {});
  },

  deleteProject: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    await projectsOps.deleteProject(projectId);
    res.json({ success: true });
  },

  updateProject: async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.dbUser?.id;
      const orgId = getOrgIdOrUnedfined(req.workspace);

      if (!userId) {
        console.log("Unauthorized");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!req.body.siteId) {
        const site = await sitesOps.siteExists({
          userId: !req.body.organizationId ? req.dbUser?.id : undefined,
          organizationId: req.body.organizationId ? orgId : undefined,
          placeId: req.body.placeId,
          address: req.body.address,
          postalCode: req.body.postalCode,
          city: req.body.city,
        });

        if (site) {
          req.body.siteId = site.id;
        } else {
          const newSite = await sitesOps.createSite({
            data: {
              address: req.body.address,
              city: req.body.city,
              state: req.body.state,
              postalCode: req.body.postalCode,
              country: req.body.country,
              placeId: req.body.placeId,
              latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
              longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
            },
            organizationId: req.body.organizationId ? orgId : undefined,
            userId: !req.body.organizationId ? req.dbUser?.id : undefined,
          });

          req.body.siteId = newSite.id;
        }
      }     
      
      const validatedData = schemas.updateProject.parse(req.body);


      const project = await projectsOps.updateProject(projectId, validatedData);
      res.json(project);
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: "Failed to update project" });
    }
  },

  getProjectMembers: async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const members = await projectsOps.getProjectMembers(projectId);
    res.json(members);
  },
};
