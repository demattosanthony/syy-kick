import { Router, Request, Response } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "../createAuthToken";
import db from "../config/db";
import { and, eq } from "drizzle-orm";
import myPassport, { authenticateSaml } from "../config/passport";
import {
  organizationInvites,
  organizationMembers,
  organizations,
  users,
} from "../config/schema";
import s3 from "../config/s3";
import { CONFIG } from "../config/constants";

const addLogoUrl = (org: any) => ({
  ...org,
  logo: org.logo ? s3.presign(org.logo, { expiresIn: 3600 }) : null,
});

const getUserWithOrgs = async (userId: string) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { organizationMembers: { with: { organization: true } } },
  });

  if (user?.organizationMembers) {
    user.organizationMembers = user.organizationMembers.map((member) => ({
      ...member,
      organization: member.organization && addLogoUrl(member.organization),
    }));
  }
  return user;
};

const checkInvite = async (token: string) => {
  const invite = await db.query.organizationInvites.findFirst({
    where: eq(organizationInvites.token, token),
    with: { organization: true },
  });
  if (!invite?.organizationId) throw new Error("Invalid invite");
  return invite;
};

const addOrgMember = async (orgId: string, userId: string) => {
  const existing = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, userId)
    ),
  });
  if (existing) return existing;

  const [member] = await db
    .insert(organizationMembers)
    .values({ organizationId: orgId, userId, role: "member" })
    .returning();
  return member;
};

const checkOrgCapacity = async (orgId: string) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { seats: true, subscriptionStatus: true },
    with: { members: { columns: { id: true } } },
  });

  if (org?.subscriptionStatus !== "active")
    throw new Error("inactive_subscription");
  if (org?.seats && org.members.length >= org.seats)
    throw new Error("insufficient_seats");
};

// Request handlers that use ops
const handlers = {
  googleCallback: async (req: Request, res: Response) => {
    const user = req.user as DbUser;
    const state = req.query.state as string | undefined;

    sendAuthCookies(res, user);

    // If there's a state parameter containing invite token, process it
    if (state) {
      try {
        // Verify and process invite
        const invite = await checkInvite(state);
        await addOrgMember(invite.organizationId as string, user.id);
        res.redirect(
          `${process.env.FRONTEND_URL}?orgJoined=true&orgId=${invite.organizationId}`
        );
        return;
      } catch (error: any) {
        res.redirect(`${process.env.FRONTEND_URL}?error=${error.message}`);
        return;
      }
    }

    res.redirect(process.env.FRONTEND_URL!);
  },

  samlCallback: (req: Request, res: any) => {
    sendAuthCookies(res, req.user as DbUser);
    res.redirect(process.env.FRONTEND_URL!);
  },

  logout: (req: Request, res: any) => {
    const options = CONFIG.COOKIE_OPTIONS;
    res
      .clearCookie("id", options)
      .clearCookie("rid", options)
      .status(200)
      .send({
        success: true,
        message: "Logged out",
      });
  },

  me: async (req: Request, res: any) => {
    try {
      const { id, rid } = req.cookies;
      if (!id || !rid) {
        res.status(200).json(null);
        return;
      }
      const { userId } = await checkTokens(id, rid);
      const user = await getUserWithOrgs(userId);
      res.status(200).json(user || null);
    } catch (error) {
      res.status(200).json(null);
    }
  },

  joinWithInvite: async (req: Request, res: Response) => {
    try {
      const invite = await checkInvite(req.params.token);
      await checkOrgCapacity(invite.organizationId as string);

      if (!req.dbUser) {
        res.status(401).json({
          message: "Authentication required",
          inviteToken: req.params.token,
        });
        return;
      }

      await addOrgMember(invite.organizationId as string, req.dbUser.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  },
};

// Auth configs
const googleAuthConfig = {
  session: false,
  failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
};

const optionalAuth = async (req: any, res: any, next: any) => {
  try {
    const { id, rid } = req.cookies;
    if (id && rid) {
      const { user } = await checkTokens(id, rid);
      if (user) {
        sendAuthCookies(res, user);
        req.dbUser = user;
      }
    }
    next();
  } catch {
    // Continue even if auth fails
    next();
  }
};

// Router
export default Router()
  .get("/google", (req, res) => {
    myPassport.authenticate("google", {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
      state: req.query.state as string,
    })(req, res);
  })
  .get(
    "/google/callback",
    myPassport.authenticate("google", googleAuthConfig),
    handlers.googleCallback
  )
  .get("/saml/:slug", authenticateSaml)
  .post("/saml/:slug/callback", authenticateSaml, handlers.samlCallback)
  .get("/saml/check/:slug", async (req: Request, res: Response) => {
    const { slug } = req.params;

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
      with: {
        samlConfig: true,
      },
    });

    if (!org || !org.samlConfig) {
      res.status(404).json({
        error: "Organization not found.",
      });
      return;
    }

    res.status(200).json({ valid: true });
    return;
  })
  .post("/logout", handlers.logout)
  .post("/invite/:token", optionalAuth, handlers.joinWithInvite)
  .get("/me", handlers.me);
