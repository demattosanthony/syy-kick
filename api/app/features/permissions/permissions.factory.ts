import Constants from "./permissions.constants";
import { permissionsOps } from "./permissions.ops";
import { PermissionManager } from "./permissions.tools";
import { Permissions } from "./permissions.types";

abstract class BasePermissionsFactory {
  abstract role: Permissions.Roles;

  async createAccess(
    userId: string,
    organizationId: string,
    permissions: Record<string, string[]>
  ) {
    const roleId = await PermissionManager.getRoleId(this.role);
    if (!roleId) {
      throw new Error("Role not found");
    }

    await permissionsOps.createOrgPermissions(
      userId,
      organizationId,
      roleId,
      permissions
    );
  }

  static async addProjectAccess(
    userId: string,
    projectId: string,
    organizationId: string,
    roleId: string,
    permissions: Record<string, string[]>
  ) {
    await permissionsOps.createMemberProjectAccess(
      userId,
      projectId,
      organizationId,
      roleId,
      permissions
    );
  }
}

class OrganizationAdmin extends BasePermissionsFactory {
  role = Permissions.Roles.ORGANIZATION_ADMIN;
}

class OrganizationManager extends BasePermissionsFactory {
  role = Permissions.Roles.ORGANIZATION_MANAGER;
}

class ProjectManager extends BasePermissionsFactory {
  role = Permissions.Roles.PROJECT_MANAGER;
}

class ProjectMember extends BasePermissionsFactory {
  role = Permissions.Roles.PROJECT_MEMBER;
}

class SuperAdmin extends BasePermissionsFactory {
  role = Permissions.Roles.SUPER_ADMIN;
}

export default class PermissionsFactory {
  /**
   * Create a user with the specified role and permissions
   * @param {Permissions.Roles} role - The role of the user
   * @param {string} organizationId - The organization ID
   * @param {string} userId - The user ID
   * @param {Record<Permissions.Resources, Permissions.Actions[]>} customPermissions - Custom permissions for the user
   * @returns {Promise<void>}
   * @example
   * PermissionsFactory.createAccess(
   *  Permissions.Roles.ORGANIZATION_ADMIN,
   *  "org-id",
   *  "user-id",
   *  {
   *    org: ["create", "read", "update", "delete"],
   *    org_members: ["create", "read", "update", "delete"],
   *    ...
   *  }
   * );
   */
  static async createAccess(
    role: Permissions.Roles,
    organizationId: string,
    userId: string,
    customPermissions?: Record<Permissions.Resources, Permissions.Actions[]>
  ): Promise<void> {
    const permissions = {
      ...Constants.Access[role],
      ...(customPermissions || {}),
    };

    const RoleClass = {
      [Permissions.Roles.SUPER_ADMIN]: SuperAdmin,
      [Permissions.Roles.ORGANIZATION_ADMIN]: OrganizationAdmin,
      [Permissions.Roles.ORGANIZATION_MANAGER]: OrganizationManager,
      [Permissions.Roles.PROJECT_MANAGER]: ProjectManager,
      [Permissions.Roles.PROJECT_MEMBER]: ProjectMember,
    }[role];

    if (!RoleClass) {
      throw new Error("Invalid role");
    }

    const userInstance = new RoleClass();
    await userInstance.createAccess(
      userId,
      organizationId,
      await PermissionManager.permissionsNamesToIds(permissions)
    );
  }
}
