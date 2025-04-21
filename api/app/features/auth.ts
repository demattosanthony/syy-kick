import { Router, Request, Response } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "../createAuthToken";
import db from "../config/db";
import { and, eq, inArray, isNull, name, or } from "drizzle-orm";
import myPassport, { authenticateSaml } from "../config/passport";
import {
  memberRoles,
  organizationInvites,
  organizations,
  roles,
  sites,
  users,
} from "../config/schema";
import s3 from "../config/s3";
import { CONFIG } from "../config/constants";
import PermissionsFactory from "./permissions/permissions.factory";
import { Permissions } from "./permissions/permissions.types";

const addLogoUrl = (org: any) => ({
  ...org,
  logo: org.logo ? s3.presign(org.logo, { expiresIn: 3600 }) : null,
});

const getUserWithOrgs = async (userId: string) => {
  const user = (await db.query.users.findFirst({
    where: eq(users.id, userId),
  })) as DbUser & { organizations?: any[] };

  const organizations = await db.query.memberRoles.findMany({
    where: and(eq(memberRoles.userId, userId), isNull(memberRoles.projectId)),
    with: { organization: true, role: true },
  });

  const sitesList = await db.query.sites.findMany({
    where: or(
      inArray(
        sites.organizationId,
        organizations.map((o) => o.organizationId)
      ),
      eq(sites.userId, userId)
    ),
    with: {
      projects: true,
    },
  });

  user.organizations = organizations.map((o) =>
    addLogoUrl({
      ...o.organization,
      role: o.role,
      type: "organization",
      slug: o.organization.slug,
      sites: sitesList
        .filter((s) => s.organizationId === o.organizationId)
        .map((s) => ({
          id: s.id,
          address: `${s.address}, ${s.city}, ${s.state} ${s.postalCode}`,
          projects: s.projects.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
          })),
        })),
    })
  );

  const personalSites = sitesList.filter((s) => !s.organizationId);

  user.organizations.push({
    id: user.id,
    name: "Personal",
    logo: user.profilePicture,
    type: "personal",
    slug: user.username,
    sites: personalSites.map((s) => ({
      id: s.id,
      address: `${s.address}, ${s.city}, ${s.state} ${s.postalCode}`,
      projects: s.projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
      })),
    })),
  });

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

const addOrgMember = async (orgId: string, userId: string, roleId: string) => {
  const existing = await db.query.memberRoles.findFirst({
    where: and(
      eq(memberRoles.organizationId, orgId),
      eq(memberRoles.userId, userId)
    ),
  });

  if (existing) return;

  const role = await db.query.roles.findFirst({
    where: eq(roles.id, roleId),
  });

  if (!role) throw new Error("Role not found");

  await PermissionsFactory.createOrgAccess(
    role.name as Permissions.Roles,
    orgId,
    userId
  );
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
  oauthCallback: async (req: Request, res: Response) => {
    const user = req.user as DbUser;
    const state = req.query.state as string | undefined;

    sendAuthCookies(res, user);

    // If there's a state parameter containing invite token, process it
    if (state) {
      try {
        // Verify and process invite
        const invite = await checkInvite(state);

        if (!invite?.roleId || !invite.organizationId) {
          res.status(403).json({ message: "Invalid invite" });
          return;
        }

        await addOrgMember(
          invite.organizationId as string,
          user.id,
          invite.roleId
        );

        await db
          .delete(organizationInvites)
          .where(
            and(
              eq(organizationInvites.organizationId, invite.organizationId),
              eq(organizationInvites.token, invite.token)
            )
          );

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

      if (!user) {
        res.status(401).json({
          message: "Authentication required",
        });
        return;
      }

      res.status(200).json(user || null);
    } catch (error) {
      res.status(200).json(null);
    }
  },

  joinWithInvite: async (req: Request, res: Response) => {
    try {
      const invite = await checkInvite(req.params.token);

      if (!req.dbUser) {
        res.status(401).json({
          message: "Authentication required",
          inviteToken: req.params.token,
        });
        return;
      }

      if (!invite?.roleId || !invite.organizationId) {
        res.status(403).json({ message: "Invalid invite" });
        return;
      }

      // Check if the user is already a member of this organization
      const existingMembership = await db.query.memberRoles.findFirst({
        where: and(
          eq(memberRoles.organizationId, invite.organizationId),
          eq(memberRoles.userId, req.dbUser.id)
        ),
      });

      if (existingMembership) {
        // User is already a member, return success with alreadyMember flag
        res.json({ success: true, alreadyMember: true });
        return;
      }

      if (invite.email !== req.dbUser.email) {
        throw new Error("wrong_email");
      }

      await checkOrgCapacity(invite.organizationId as string);

      await addOrgMember(
        invite.organizationId as string,
        req.dbUser.id,
        invite.roleId
      );

      await db
        .delete(organizationInvites)
        .where(
          and(
            eq(organizationInvites.organizationId, invite.organizationId),
            eq(organizationInvites.token, invite.token)
          )
        );
      res.json({ success: true });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  },
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

// Auth configs
const authConfig = {
  session: false,
  failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
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
    myPassport.authenticate("google", authConfig),
    handlers.oauthCallback
  )
  .get("/microsoft", (req, res) => {
    myPassport.authenticate("microsoft", {
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL}?error=unauthorized`,
      state: req.query.state as string,
    })(req, res);
  })
  .get(
    "/microsoft/callback",
    myPassport.authenticate("microsoft", authConfig),
    handlers.oauthCallback
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
