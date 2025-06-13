/** Drizzle */
import { eq, and, isNull, isNotNull } from "drizzle-orm";

/** Types */
import { DbUser } from "../../../createAuthToken";
import { Permissions } from "../../permissions/permissions.types";

/** Schema */
import { memberRoles, roles, users } from "../../../config/schema";

/** Config */
import db from "../../../config/db";

/** Ops */
import { permissionsOps } from "../../permissions/permissions.ops";

/** Tools */
import { PermissionManager } from "../../permissions/permissions.tools";

export const ops = {
  async listMembers(orgId: string, user: DbUser) {
    if (!orgId) {
      throw new Error("Please select an organization");
    }

    if (!user) {
      throw new Error("Unauthorized");
    }

    const userRole = await permissionsOps.getUserOrganizationRole(
      user.id,
      orgId
    );

    if (!userRole) {
      throw new Error("User not found in organization");
    }

    const members = await db
      .select({
        id: memberRoles.userId,
        email: users.email,
        profilePicture: users.profilePicture,
        name: users.name,
        role: roles,
        createdAt: memberRoles.createdAt,
      })
      .from(memberRoles)
      .innerJoin(users, eq(users.id, memberRoles.userId))
      .innerJoin(roles, eq(roles.id, memberRoles.roleId))
      .where(eq(memberRoles.organizationId, orgId));

    return members.map((member) => {
      const hasSuperiorRole = PermissionManager.hasSuperiorRole(
        userRole?.role.name as Permissions.Roles,
        member.role.name as Permissions.Roles
      );
      return {
        ...member,
        canUpdate: hasSuperiorRole,
        canDelete: hasSuperiorRole,
      };
    });
  },

  async getMemberRole(userId: string, orgId: string) {
    const role = await permissionsOps.getUserOrganizationRole(userId, orgId);

    if (!role) {
      throw new Error("User not found in organization");
    }

    const formattedRole = PermissionManager.formatUserRole(role);

    return formattedRole;
  },
};
