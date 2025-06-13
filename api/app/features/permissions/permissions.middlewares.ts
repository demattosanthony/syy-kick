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

      const resourceId = await PermissionManager.getResourseId(resource);

      if (!resourceId) {
        res.status(403).json({ error: "Resource not found." });
        return;
      }

      let orgRole = await PermissionManager.getUserOrganisationRole(
        userId,
        orgId
      );

      if (!orgRole) {
        await PermissionManager.logAccess(
          userId,
          action,
          resource,
          Permissions.Status.UNAUTHORIZED,
          {
            organizationId: orgId,
          }
        );
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
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
        await PermissionManager.logAccess(
          userId,
          action,
          resource,
          Permissions.Status.UNAUTHORIZED,
          {
            organizationId: orgId,
          }
        );
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }

      await PermissionManager.logAccess(
        userId,
        action,
        resource,
        Permissions.Status.AUTHORIZED,
        {
          organizationId: orgId,
        }
      );

      next();
    };
  }
}
