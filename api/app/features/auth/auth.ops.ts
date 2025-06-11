/** Config */
import db from "../../config/db";
import s3 from "../../config/s3";
import {
  accessTokens,
  memberRoles,
  organizationInvites,
  organizations,
  roles,
  users,
} from "../../config/schema";
import { DbUser } from "../../createAuthToken";
import PermissionsFactory from "../permissions/permissions.factory";
import { Permissions } from "../permissions/permissions.types";

/** Types */
import { AccessTokenProvider } from "./auth.types";

/** ORM */
import { and, eq, inArray, or } from "drizzle-orm";

export const ops = {
  addAccessToken: async (
    userId: string,
    provider: AccessTokenProvider,
    type: "picker" | "graph",
    accessToken: string,
    refreshToken: string
  ) => {
    await db.insert(accessTokens).values({
      userId,
      provider,
      type,
      accessToken,
      refreshToken,
    });
  },

  updateAccessToken: async (
    id: string,
    accessToken: string,
    refreshToken: string
  ) => {
    await db
      .update(accessTokens)
      .set({
        accessToken,
        refreshToken,
      })
      .where(eq(accessTokens.id, id));
  },

  getAccessToken: async (id: string) => {
    return await db.query.accessTokens.findFirst({
      where: eq(accessTokens.id, id),
    });
  },

  checkInvite: async (token: string) => {
    const invite = await db.query.organizationInvites.findFirst({
      where: eq(organizationInvites.token, token),
      with: { organization: true },
    });
    if (!invite?.organizationId) throw new Error("Invalid invite");
    return invite;
  },

  addOrgMember: async (orgId: string, userId: string, roleId: string) => {
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
  },

  addLogoUrl: (org: any) => ({
    ...org,
    logo: org.logo ? s3.presign(org.logo, { expiresIn: 3600 }) : null,
  }),

  getUserWithOrgs: async (userId: string) => {
    const user = (await db.query.users.findFirst({
      where: eq(users.id, userId),
    })) as DbUser & { organizations?: any[] };

    const organizations = await db.query.memberRoles.findMany({
      where: eq(memberRoles.userId, userId),
      with: { organization: true, role: true },
    });

    user.organizations = organizations.map((o) =>
      ops.addLogoUrl({
        ...o.organization,
        role: o.role,
        type: "organization",
        slug: o.organization.slug,
      })
    );

    user.organizations.push({
      id: user.id,
      name: "Personal",
      logo: user.profilePicture,
      type: "personal",
      slug: user.username,
    });

    return user;
  },

  checkOrgCapacity: async (orgId: string) => {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { seats: true, subscriptionStatus: true },
      with: { members: { columns: { id: true } } },
    });

    if (!["active", "trialing"].includes(org?.subscriptionStatus as string))
      throw new Error("inactive_subscription");
    if (org?.seats && org.members.length >= org.seats)
      throw new Error("insufficient_seats");
  },
};
