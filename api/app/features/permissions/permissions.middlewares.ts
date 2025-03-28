import { NextFunction, Request, Response } from "express";
import { Permissions } from "./permissions.types";
import { getOrgIdOrUnedfined } from "../../utils";
import { PermissionManager } from "./permissions.tools";
import Constants from "./permissions.constants";

export default class PermissionsMiddlewares {
  static organizations(
    resource: Permissions.Resources,
    action: Permissions.Actions
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.dbUser) {
        res.status(403).json({ error: "Please login to your account." });
        return;
      }

      const orgId = getOrgIdOrUnedfined(req.workspace);
      const { id: userId } = req.dbUser;

      // Check if user is a member of an organization
      if (!orgId) {
        res.status(403).json({ error: "Please select an organization." });
        return;
      }

      let orgRole = await PermissionManager.getUserOrganisationRole(
        userId,
        orgId
      );

      if (!orgRole) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      const resourceId = await PermissionManager.getResourseId(resource);

      if (!resourceId) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // If it's not an organization resource, the middleware used is not the right one
      if (!Constants.OrganizationResources.includes(resource)) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // User try to access an organization resource
      const hasAccess = await PermissionManager.userHasAccessToRessource(
        orgRole,
        orgId,
        resourceId,
        action
      );

      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      next();
    };
  }

  static sites(
    resource: Permissions.Resources,
    action: Permissions.Actions
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.dbUser) {
        res.status(403).json({ error: "Please login to your account." });
        return;
      }

      const orgId = getOrgIdOrUnedfined(req.workspace);
      const { id: userId } = req.dbUser;

      // Check if user is trying to create a personal site, if so, skip permission check
      if (
        resource === Permissions.Resources.ORGANIZATION_SITES &&
        action === Permissions.Actions.CREATE &&
        !orgId
      ) {
        next();
        return;
      }

      const { id: siteId } = req.params;

      const isUserSite = await PermissionManager.isUserSite(userId, siteId);

      // Check if the user is the site owner, if so, skip permission check
      if (siteId && isUserSite) {
        next();
        return;
      }

      // Check if user is a member of an organization
      if (!orgId) {
        res.status(403).json({ error: "Please select an organization." });
        return;
      }

      let orgRole = await PermissionManager.getUserOrganisationRole(
        userId,
        orgId
      );

      if (!orgRole) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      const resourceId = await PermissionManager.getResourseId(resource);

      if (!resourceId) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // If it's not a site resource, the middleware used is not the right one
      if (!Constants.OrganizationSitesResources.includes(resource)) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // User is an organization admin or manager, skip permission check
      if (
        [
          Permissions.Roles.ORGANIZATION_ADMIN,
          Permissions.Roles.ORGANIZATION_MANAGER,
        ].includes(orgRole.role.name as Permissions.Roles)
      ) {
        next();
        return;
      }

      // siteId not provided, required for a site resource if the action is not create
      if (
        !siteId &&
        resource === Permissions.Resources.ORGANIZATION_SITES &&
        action !== Permissions.Actions.CREATE
      ) {
        res.status(403).json({ error: "Site not found." });
        return;
      }

      const hasAccess = await PermissionManager.userHasAccessToRessource(
        orgRole,
        orgId,
        resourceId,
        action
      );

      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      next();
    };
  }

  static projects(
    resource: Permissions.Resources,
    action: Permissions.Actions
  ): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.dbUser) {
        res.status(403).json({ error: "Please login to your account." });
        return;
      }

      const orgId = getOrgIdOrUnedfined(req.workspace);
      const { id: userId } = req.dbUser;

      // Check if user is trying to create a personal project, if so, skip permission check
      if (
        resource === Permissions.Resources.ORGANIZATION_PROJECTS &&
        action === Permissions.Actions.CREATE &&
        !orgId
      ) {
        next();
        return;
      }

      const { projectId } = req.params;

      const isUserProject = await PermissionManager.isUserProject(
        userId,
        projectId
      );

      // Check if the user is the project owner, if so, skip permission check
      if (projectId && isUserProject) {
        next();
        return;
      }

      // Check if user is a member of an organization
      if (!orgId) {
        res.status(403).json({ error: "Please select an organization." });
        return;
      }

      let orgRole = await PermissionManager.getUserOrganisationRole(
        userId,
        orgId
      );

      if (!orgRole) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      const resourceId = await PermissionManager.getResourseId(resource);

      if (!resourceId) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // If it's not a project resource, the middleware used is not the right one
      if (!Constants.OrganizationProjectResources.includes(resource)) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      // User is an organization admin or manager, skip permission check
      if (
        [
          Permissions.Roles.ORGANIZATION_ADMIN,
          Permissions.Roles.ORGANIZATION_MANAGER,
        ].includes(orgRole.role.name as Permissions.Roles)
      ) {
        next();
        return;
      }

      // projectId not provided, required for a project resource if the action is not create
      if (
        !projectId &&
        resource === Permissions.Resources.ORGANIZATION_PROJECTS &&
        action !== Permissions.Actions.CREATE
      ) {
        res.status(403).json({ error: "Project not found." });
        return;
      }

      const hasAccess = await PermissionManager.userHasAccessToRessource(
        orgRole,
        orgId,
        resourceId,
        action,
        projectId
      );

      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }
      next();
    };
  }
}
