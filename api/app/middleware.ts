import { and, eq } from "drizzle-orm";
import { CONFIG } from "./config/constants";
import db from "./config/db";
import { organizationMembers, organizations } from "./config/schema";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "./createAuthToken";
import { Permissions } from "./features/permissions/permissions.types";
import { PermissionManager } from "./features/permissions/permissions.tools";
import { getOrgIdOrUnedfined } from "./utils";

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

const permissionManager = new PermissionManager();

export const permissions = (
  resource: Permissions.Resources,
  action: Permissions.Actions
) => {
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

    let orgRoleId = await PermissionManager.getUserOrganisationRole(
      userId,
      orgId
    );

    const { projectId } = req.params;
    const resourceId = await PermissionManager.getResourseId(resource);

    if (!resourceId) {
      res.status(403).json({ error: "Resource not found." });
      return;
    }

    if (orgRoleId) {
      let userHasAccessToRessource =
        await permissionManager.userHasAccessToRessource(
          Permissions.Level.ORGANIZATION,
          orgRoleId,
          resourceId,
          action
        );

      if (!userHasAccessToRessource) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });

        return;
      }
      // IF user is not an organization member, check if user is a project member
    } else if (projectId) {
      const projectRoleId = await permissionManager.getUserProjectRole(
        userId,
        projectId
      );

      if (!projectRoleId) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });

        return;
      }

      let userHasAccessToRessource =
        await permissionManager.userHasAccessToRessource(
          Permissions.Level.PROJECT,
          projectRoleId,
          resourceId,
          action
        );

      if (!userHasAccessToRessource) {
        res
          .status(403)
          .json({ error: "You don't have access to this resource." });

        return;
      }
    } else {
      res
        .status(403)
        .json({ error: "You don't have access to this resource." });

      return;
    }

    next();
  };
};
