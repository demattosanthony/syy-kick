import { and, eq } from "drizzle-orm";
import { CONFIG } from "./config/constants";
import db from "./config/db";
import { organizationMembers, organizations } from "./config/schema";
import { Request, Response, NextFunction } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "./createAuthToken";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      dbUser?: DbUser;
      userId?: string;
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

    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Subscription check
export const checkSub = async (req: any, res: any, next: any) => {
  if (!CONFIG.__prod__ || CONFIG.EMAIL_WHITELIST.includes(req.dbUser.email))
    return next();

  // Check if request has organizationId (indicating org workspace request)
  const organizationId = req.body?.organizationId || req.query?.organizationId;

  if (organizationId) {
    // Check organization subscription
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      with: {
        members: {
          where: eq(organizationMembers.userId, req.dbUser.id),
        },
      },
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (["trialing", "active"].includes(org.subscriptionStatus as string)) {
      return next();
    }
    return res.status(402).json({ error: "Subscription required" });
  }

  // Fallback to checking user's personal subscription
  if (!["trialing", "active"].includes(req.dbUser?.subscriptionStatus)) {
    return res.status(402).json({ error: "Subscription required" });
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
