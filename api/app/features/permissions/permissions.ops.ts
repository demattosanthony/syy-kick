import { and, eq, inArray, not } from "drizzle-orm";
import db from "../../config/db";
import {
  organizationInvites,
  organizationMemberRoles,
  organizations,
  permissions,
  permissions as permissionsTable,
  projectMemberRoles,
  projects,
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
      .insert(organizationMemberRoles)
      .values({
        organizationId: orgId,
        organizationMemberId: userId,
        roleId,
      })
      .returning({ id: organizationMemberRoles.id });

    await permissionsOps.insertPermissions(permissions, orgMemberRole.id);
  },
  /** ---- Create Project permissions for a member */
  createMemberProjectAccess: async (
    userId: string,
    projectId: string,
    organizationId: string,
    roleId: string,
    permissions: Record<string, string[]> // ressourceId: actionId[]
  ): Promise<void> => {
    const [projectMemberRole] = await db
      .insert(projectMemberRoles)
      .values({
        userId,
        projectId,
        organizationId,
        roleId,
      })
      .returning({ id: projectMemberRoles.id });

    await permissionsOps.insertPermissions(permissions, projectMemberRole.id);
  },

  /** ---- Insert permissions */
  insertPermissions: async (
    permissions: Record<string, string[]>,
    orgRoleId?: string,
    projectRoleId?: string
  ): Promise<void> => {
    const permissionValues = Object.entries(permissions).flatMap(
      ([resourceId, actionIds]) =>
        actionIds.map((actionId) => ({
          orgMemberRoleId: orgRoleId,
          projectMemberRoleId: projectRoleId,
          resourceId,
          actionId,
        }))
    );

    await db.insert(permissionsTable).values(permissionValues);
  },

  /** ---- Remove Organization permissions */
  removeOrgPermissions: async (userId: string, orgId: string) => {
    await db
      .delete(organizationMemberRoles)
      .where(
        and(
          eq(organizationMemberRoles.organizationId, orgId),
          eq(organizationMemberRoles.organizationMemberId, userId)
        )
      );

    await db
      .delete(projectMemberRoles)
      .where(
        and(
          eq(projectMemberRoles.userId, userId),
          eq(projectMemberRoles.organizationId, orgId)
        )
      );
  },

  /** ---- Get user organization role ---- */
  getUserOrganizationRole: async (
    userId: string,
    orgId: string
  ): Promise<RawUserRole | undefined> => {
    const userRole = await db.query.organizationMemberRoles.findFirst({
      where: and(
        eq(organizationMemberRoles.organizationMemberId, userId),
        eq(organizationMemberRoles.organizationId, orgId)
      ),
      with: {
        role: true,
      },
    });

    if (!userRole) {
      return undefined;
    }

    if (
      [
        Permissions.Roles.PROJECT_MANAGER,
        Permissions.Roles.PROJECT_MEMBER,
      ].includes(userRole.role.name as Permissions.Roles)
    ) {
      const projectMemberRolesList = await db.query.projectMemberRoles.findMany(
        {
          where: and(
            eq(projectMemberRoles.userId, userId),
            eq(projectMemberRoles.organizationId, orgId)
          ),
          with: {
            role: true,
            project: true,
          },
        }
      );

      if (projectMemberRolesList.length > 0) {
        const permissions = await db.query.permissions.findMany({
          where: eq(
            permissionsTable.projectMemberRoleId,
            projectMemberRolesList[0].id // TODO: manage access on project level
          ),
          with: {
            action: true,
            resource: true,
          },
        });

        return {
          ...userRole,
          permissions,
        };
      }
    }

    const permissions = await db.query.permissions.findMany({
      where: eq(permissionsTable.orgMemberRoleId, userRole.id),
      with: {
        action: true,
        resource: true,
      },
    });

    return {
      ...userRole,
      permissions,
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
          memberId: organizationMemberRoles.organizationMemberId,
          userEmail: users.email,
        })
        .from(organizationMemberRoles)
        .innerJoin(
          users,
          eq(users.id, organizationMemberRoles.organizationMemberId)
        )
        .where(
          and(
            eq(organizationMemberRoles.organizationId, orgId),
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
        ? PermissionManager.canUpdateRole(
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

  getTransferableProjects: async (req: Request, res: Response) => {
    const orgId = req.params.orgId;
    const user = req.dbUser!;

    if (!orgId) {
      res.status(403).json({ error: "Please select an organization" });
      return;
    }

    if (!user) {
      res.status(403).json({ error: "Please login to your account" });
      return;
    }

    const userOrganisationRole = await permissionsOps.getUserOrganizationRole(
      user.id,
      orgId
    );

    // User has access to all projects in the organization (ORGANIZATION_ADMIN or ORGANIZATION_MANAGER)
    if (userOrganisationRole) {
      res.json(
        await db.query.projects.findMany({
          where: eq(projects.organizationId, orgId),
          columns: {
            id: true,
            name: true,
          },
        })
      );
      return;
    }

    // User has access to some projects in the organization (PROJECT_MANAGER or PROJECT_MEMBER)
    const userProjects = await db.query.projectMemberRoles.findMany({
      where: eq(projectMemberRoles.userId, user.id),
      columns: {
        projectId: true,
      },
      with: {
        project: {
          columns: {
            name: true,
          },
        },
      },
    });

    res.json(
      userProjects.map((project) => ({
        id: project.projectId,
        name: project.project.name,
      }))
    );
  },

  updateOrgMemberRole: async (req: Request, res: Response) => {
    const { orgId, memberId } = req.params;
    const user = req.dbUser!;
    const { resources, roleId, projectIds } = req.body as {
      resources: Record<string, string[]>; // resourceId: actionId[]
      roleId: string;
      projectIds?: string[];
    };

    const newRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    // Check if the role exists
    if (!newRole) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    const userOrgRole = await permissionsOps.getUserOrganizationRole(
      user.id,
      orgId
    );

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
      !PermissionManager.canUpdateRole(
        userOrgRole.role.name as Permissions.Roles,
        currentMemberRole.role.name as Permissions.Roles
      )
    ) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // If the user has an organization role, remove all the organization access
    await db
      .delete(organizationMemberRoles)
      .where(
        and(
          eq(organizationMemberRoles.organizationMemberId, memberId),
          eq(organizationMemberRoles.organizationId, orgId)
        )
      );

    // If the user has a project role, remove all the project access
    await db
      .delete(projectMemberRoles)
      .where(
        and(
          eq(projectMemberRoles.userId, memberId),
          eq(projectMemberRoles.organizationId, orgId)
        )
      );

    if (
      [
        Permissions.Roles.PROJECT_MANAGER,
        Permissions.Roles.PROJECT_MEMBER,
      ].includes(newRole.name as Permissions.Roles)
    ) {
      if (!projectIds) {
        res.status(400).json({ error: "Project ids are required" });
        return;
      }

      if (projectIds.length > 0) {
        const insertedProjectMemberRoles = await db
          .insert(projectMemberRoles)
          .values(
            projectIds.map((projectId) => ({
              userId: memberId,
              projectId,
              organizationId: orgId,
              roleId,
            }))
          )
          .returning({
            id: projectMemberRoles.id,
          });

        const permissionsToInsert = insertedProjectMemberRoles.flatMap(
          ({ id: projectMemberRoleId }) =>
            Object.entries(resources).flatMap(([resourceId, actionIds]) =>
              actionIds.map((actionId) => ({
                roleId,
                resourceId,
                actionId,
                projectMemberRoleId,
              }))
            )
        );

        await db.insert(permissions).values(permissionsToInsert);
      }
    }

    const orgMemberRoleId = await db
      .insert(organizationMemberRoles)
      .values({
        organizationMemberId: memberId,
        organizationId: orgId,
        roleId,
      })
      .returning({ id: organizationMemberRoles.id })
      .then((result) => result[0].id);

    // Create new organization permissions if the new role is an organization role
    if (
      [
        Permissions.Roles.ORGANIZATION_ADMIN,
        Permissions.Roles.ORGANIZATION_MANAGER,
      ].includes(newRole.name as Permissions.Roles)
    ) {
      await db.insert(permissions).values(
        Object.entries(resources).flatMap(([resourceId, actionIds]) =>
          actionIds.map((actionId) => ({
            roleId,
            resourceId,
            actionId,
            orgMemberRoleId,
          }))
        )
      );
    }

    res.json({ message: "Role updated" });
  },

  async deleteOrgMembers(req: Request, res: Response): Promise<void> {
    const membersIds = req.body.membersIds as string[];
    const orgId = req.params.orgId;

    await db
      .delete(organizationMemberRoles)
      .where(
        and(
          eq(organizationMemberRoles.organizationId, orgId),
          inArray(organizationMemberRoles.organizationMemberId, membersIds)
        )
      );

    await db
      .delete(projectMemberRoles)
      .where(
        and(
          eq(projectMemberRoles.organizationId, orgId),
          inArray(projectMemberRoles.userId, membersIds)
        )
      );

    res.status(200).json({ message: "Member(s) deleted" });
  },
};
