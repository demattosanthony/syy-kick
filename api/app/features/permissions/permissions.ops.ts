import { and, eq, inArray } from "drizzle-orm";
import db from "../../config/db";
import {
  organizationInvites,
  organizations,
  memberRoles,
  permissions,
  roles,
  users,
} from "../../config/schema";
import { Permissions, RawUserRole } from "./permissions.types";
import { Request, Response } from "express";
import { getOrgIdOrUnedfined } from "../../utils";
import { Resend } from "resend";
import { orgInvitation } from "../../../emails/permissions";
import { randomBytes } from "crypto";
import s3 from "../../config/s3";
import { PermissionManager } from "./permissions.tools";

export const permissionsOps = {
  /** ---- Get Roles */
  getRoles: async () => {
    return await db.query.roles.findMany();
  },
  /** ---- Create Organization permissions */
  createOrgPermissions: async (
    userId: string,
    orgId: string,
    roleId: string,
    permissions: Record<string, string[]> // ressourceId: actionId[]
  ): Promise<void> => {
    const [orgMemberRole] = await db
      .insert(memberRoles)
      .values({
        organizationId: orgId,
        userId: userId,
        roleId,
      })
      .returning({ id: memberRoles.id });

    await permissionsOps.insertPermissions(permissions, orgMemberRole.id);
  },

  /** ---- Insert permissions */
  insertPermissions: async (
    permissionsList: Record<string, string[]>,
    memberRoleId: string
  ): Promise<void> => {
    const permissionValues = Object.entries(permissionsList).flatMap(
      ([resourceId, actionIds]) =>
        actionIds.map((actionId) => ({
          memberRoleId,
          resourceId,
          actionId,
        }))
    );

    await db.insert(permissions).values(permissionValues);
  },

  /** ---- Remove Organization permissions */
  removeOrgPermissions: async (userId: string, orgId: string) => {
    await db
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.organizationId, orgId),
          eq(memberRoles.userId, userId)
        )
      );
  },

  /** ---- Get user organization role ---- */
  getUserOrganizationRole: async (
    userId: string,
    orgId: string
  ): Promise<RawUserRole | undefined> => {
    const userRole = await db.query.memberRoles.findFirst({
      where: and(
        eq(memberRoles.userId, userId),
        eq(memberRoles.organizationId, orgId)
      ),
      with: {
        role: true,
      },
    });

    if (!userRole) {
      return undefined;
    }

    const permissionsList = await db.query.permissions.findMany({
      where: eq(permissions.memberRoleId, userRole.id),
      with: {
        action: true,
        resource: true,
      },
    });

    return {
      ...userRole,
      permissions: permissionsList,
    };
  },

  /** ---- Org invitations */
  inviteUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = getOrgIdOrUnedfined(req.workspace);
      const user = req.dbUser!;
      const invitations = req.body.invitations as {
        roleId: string;
        email: string;
      }[];

      if (!orgId) {
        res.status(403).json({ error: "Please select an organization." });
        return;
      }

      if (!user) {
        res.status(403).json({ error: "Please login to your account." });
        return;
      }

      // Get existing invitations mails in the organization
      const existingInvitations = await db.query.organizationInvites.findMany({
        where: and(
          eq(organizationInvites.organizationId, orgId),
          inArray(
            organizationInvites.email,
            invitations.map((invitation) => invitation.email)
          )
        ),
      });

      // Get existing organization members
      const existingOrgMembers = await db
        .select({
          memberId: memberRoles.userId,
          userEmail: users.email,
        })
        .from(memberRoles)
        .innerJoin(users, eq(users.id, memberRoles.userId))
        .where(
          and(
            eq(memberRoles.organizationId, orgId),
            eq(users.email, user.email)
          )
        );

      // Get existing emails
      const existingEmails = new Set([
        ...existingInvitations.map((invitation) => invitation.email),
        ...existingOrgMembers.map((member) => member.userEmail),
      ]);

      // only invite users that are not already in the organization
      const newInvitations = invitations.filter(
        (invitation) => !existingEmails.has(invitation.email)
      );

      const resend = new Resend(process.env.RESEND_API_KEY);

      const organizationInvitations = newInvitations.map((invitation) => {
        const token = randomBytes(16).toString("hex");

        return {
          organizationId: orgId,
          token,
          roleId: invitation.roleId,
          email: invitation.email,
          invitedBy: user.id,
        };
      });

      if (organizationInvitations.length === 0) {
        res.status(200).json({ error: "Invitations sent" });
        return;
      }

      await db.insert(organizationInvites).values(organizationInvitations);

      const organization = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });

      if (!organization) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }

      organizationInvitations.forEach(async (invitation) => {
        const invitationLink = `${process.env.FRONTEND_URL}/onboarding/orgs/join/${invitation.token}`;
        resend.emails.send({
          from: "invitations@noreply.syyclops.com",
          to: invitation.email,
          subject: "Invitation to join organization",
          html: orgInvitation(
            {
              name: user.name || "",
              email: user.email,
            },
            invitationLink,
            {
              name: organization?.name || "",
              logo: organization.logo
                ? s3.file(organization.logo).presign({ expiresIn: 3600 })
                : undefined,
            }
          ),
        });
      });

      res.status(200).json({ message: "Invitations sent" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getInvitations: async (req: Request, res: Response) => {
    const orgId = getOrgIdOrUnedfined(req.workspace);
    const user = req.dbUser!;

    if (!orgId) {
      res.status(403).json({ error: "Please select an organization" });
      return;
    }

    if (!user) {
      res.status(403).json({ error: "Please login to your account" });
      return;
    }

    const invitations = await db.query.organizationInvites.findMany({
      where: eq(organizationInvites.organizationId, orgId),
      with: {
        role: true,
      },
    });

    const userRole = await permissionsOps.getUserOrganizationRole(
      user.id,
      orgId
    );

    if (!userRole) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const formattedInvitations = invitations.map((invitation) => ({
      id: invitation.id,
      link: `${process.env.FRONTEND_URL}/onboarding/orgs/join/${invitation.token}`,
      email: invitation.email,
      role: invitation.role,
      canUpdate: invitation.role
        ? PermissionManager.hasSuperiorRole(
            userRole.role.name as Permissions.Roles,
            invitation.role.name as Permissions.Roles
          )
        : false,
      createdAt: invitation.createdAt,
    }));

    res.status(200).json(formattedInvitations);
  },

  deleteInvitations: async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const invitationsIds = req.body.invitationsIds as string[];

    await db
      .delete(organizationInvites)
      .where(
        and(
          eq(organizationInvites.organizationId, orgId),
          inArray(organizationInvites.id, invitationsIds)
        )
      );

    res.status(200).json({ message: "Invitations deleted" });
  },

  updateOrgMemberRole: async (req: Request, res: Response) => {
    const { orgId, memberId } = req.params;
    const user = req.dbUser!;
    const { resources, roleId } = req.body as {
      resources: Record<string, string[]>; // resourceId: actionId[]
      roleId: string;
    };

    const newRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    // Check if the role exists
    if (!newRole) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    // Logged in user role in the organization
    const userOrgRole = await permissionsOps.getUserOrganizationRole(
      user.id,
      orgId
    );

    // Role of the user being updated
    const currentMemberRole = await permissionsOps.getUserOrganizationRole(
      memberId,
      orgId
    );

    if (!userOrgRole) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // Check if the user has the permission to update the role
    if (
      currentMemberRole &&
      !PermissionManager.hasSuperiorRole(
        userOrgRole.role.name as Permissions.Roles,
        currentMemberRole.role.name as Permissions.Roles
      )
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // Remove existing roles
    await permissionsOps.removeOrgPermissions(memberId, orgId);

    // Recreate org role
    const [newOrgRole] = await db
      .insert(memberRoles)
      .values({
        userId: memberId,
        organizationId: orgId,
        roleId,
      })
      .returning({ id: memberRoles.id });

    // Create new organization permissions
    await db.insert(permissions).values(
      Object.entries(resources).flatMap(([resourceId, actionIds]) =>
        actionIds.map((actionId) => ({
          memberRoleId: newOrgRole.id,
          resourceId,
          actionId,
        }))
      )
    );

    // Log inserted permissions, only get resource name and action name
    const insertedPermissions = await db.query.permissions.findMany({
      where: eq(permissions.memberRoleId, newOrgRole.id),
      with: {
        resource: true,
        action: true,
      },
    });

    res.json({ message: "Role updated" });
  },

  async deleteOrgMembers(req: Request, res: Response): Promise<void> {
    const membersIds = req.body.membersIds as string[];
    const orgId = req.params.orgId;

    await db
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.organizationId, orgId),
          inArray(memberRoles.userId, membersIds)
        )
      );

    res.status(200).json({ message: "Member(s) deleted" });
  },

  async getTransferablePermissions(req: Request, res: Response) {
    const user = req.dbUser;
    const orgId = req.params.orgId;

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const permissions = await PermissionManager.getUserTransferableRoles(
      user.id,
      Permissions.Level.ORGANIZATION,
      orgId
    );
    res.json(permissions);
  },
};
