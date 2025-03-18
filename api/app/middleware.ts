import { and, eq, or } from "drizzle-orm";
import { CONFIG } from "./config/constants";
import db from "./config/db";
import { organizationMembers, organizations } from "./config/schema";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "./createAuthToken";
import { Permissions } from "./features/permissions/permissions.types";
import { PermissionManager } from "./features/permissions/permissions.tools";
import { getOrgIdOrUnedfined } from "./utils";
import Constants from "./features/permissions/permissions.constants";

export type Workspace = {
  id: string; // User ID or organization ID
  name: string;
  type: "personal" | "organization";
};

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      dbUser?: DbUser;
      userId?: string;
      workspace?: Workspace;
    }
  }
}

// Auth middleware
export const auth = async (req: any, res: any, next: any) => {
  try {
    const { id, rid } = req.cookies;
    if (!id || !rid) throw new Error();

    const { user } = await checkTokens(id, rid);

    if (user) {
      sendAuthCookies(res, user);
      req.dbUser = user;
    }

    // Check the workspace
    const workspace: Workspace = req.cookies?.activeWorkspace
      ? JSON.parse(req.cookies.activeWorkspace)
      : null;
    req.workspace = workspace;

    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Subscription check
export const checkSub = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (
    !CONFIG.__prod__ ||
    (req.dbUser && CONFIG.EMAIL_WHITELIST.includes(req.dbUser.email))
  )
    return next();

  const { workspace, dbUser } = req;

  // Check if workspace comes from an organization type
  if (workspace && workspace.type === "organization") {
    // Check organization subscription
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, workspace.id),
      with: {
        members: {
          where: eq(organizationMembers.userId, dbUser!.id),
        },
      },
    });

    if (!org) {
      console.log("Organization not found");
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (["trialing", "active"].includes(org.subscriptionStatus as string)) {
      next();
      return;
    }
    res.status(402).json({ error: "Subscription required" });
    return;
  }

  // Fallback to checking user's personal subscription
  if (!["trialing", "active"].includes(dbUser?.subscriptionStatus || "")) {
    res.status(402).json({ error: "Subscription required" });
    return;
  }

  next();
};

// Super admin check
export const superAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) =>
  req.dbUser?.systemRole === "super_admin"
    ? next()
    : res.status(403).json({ error: "Unauthorized" });

export const isOrgOwner = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, req.params.id),
      eq(organizationMembers.userId, req.dbUser!.id)
    ),
  });

  if (!member || member.role !== "owner") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  next();
};

export const permissions = (
  resource: Permissions.Resources,
  action: Permissions.Actions
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      res.status(403).json({ error: "Please login to your account." });
      return;
    }

    console.log("----- permissions middleware -----");

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

    console.log("projectId", projectId);

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

    const resourceId = await PermissionManager.getResourseId(resource);

    if (!resourceId) {
      res.status(403).json({ error: "Resource not found." });
      return;
    }

    if (!orgRole) {
      res
        .status(403)
        .json({ error: "You don't have access to this resource." });
      return;
    }

    // User try to access an organization resource
    if (Constants.OrganizationResources.includes(resource)) {
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
    }

    // User try to access an organization project resource
    if (Constants.OrganizationProjectResources.includes(resource)) {
      // An organization role has access to all project resources
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

      console.log("hasAccess ----- ", hasAccess);

      if (!hasAccess) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });
        return;
      }
    }

    console.log("---- end permissions middleware ----");
    next();
  };
};
