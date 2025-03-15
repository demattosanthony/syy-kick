import Constants from "./permissions.constants";
import { permissionsOps } from "./permissions.ops";
import { PermissionManager } from "./permissions.tools";
import { Permissions } from "./permissions.types";

export default class PermissionsFactory {
  /**
   * Create a user with the specified role and permissions
   * @param {Permissions.Roles} role - The role of the user
   * @param {string} entityId - The organization or project ID
   * @param {string} userId - The user ID
   * @param {Record<Permissions.Resources, Permissions.Actions[]>} customPermissions - Custom permissions for the user
   * @returns {Promise<void>}
   * @example
   * UserFactory.create(
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
    projectId?: string,
    customPermissions?: Record<Permissions.Resources, Permissions.Actions[]>
  ): Promise<void> {
    switch (role) {
      case Permissions.Roles.ORGANIZATION_ADMIN:
        await new OrganizationAdmin().create(
          userId,
          organizationId,
          Constants.Access[role]
        );
        break;
      case Permissions.Roles.ORGANIZATION_MANAGER:
        await new OrganizationManager().create(
          userId,
          organizationId,
          Constants.Access[role]
        );
        break;
      case Permissions.Roles.PROJECT_MANAGER:
        if (!projectId) {
          throw new Error("Project ID is required for project member");
        }
        await new ProjectManager().create(
          userId,
          organizationId,
          {
            ...Constants.Access[role],
            ...customPermissions,
          },
          projectId
        );
        break;
      case Permissions.Roles.PROJECT_MEMBER:
        if (!projectId) {
          throw new Error("Project ID is required for project member");
        }
        await new ProjectMember().create(
          userId,
          organizationId,
          {
            ...Constants.Access[role],
            ...customPermissions,
          },
          projectId
        );
        break;
      default:
        throw new Error("Invalid role");
    }
  }
}

class User {
  async create(
    userId: string,
    organizationId: string,
    permissions: Record<Permissions.Resources, Permissions.Actions[]>,
    projectId?: string
  ) {
    throw new Error("Method not implemented.");
  }
}

class OrganizationAdmin extends User {
  async create(
    userId: string,
    organizationId: string,
    permissions: Record<Permissions.Resources, Permissions.Actions[]>
  ) {
    const roleId = await PermissionManager.getRoleId(
      Permissions.Roles.ORGANIZATION_ADMIN
    );

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
}

class OrganizationManager extends User {
  async create(
    userId: string,
    organizationId: string,
    permissions: Record<Permissions.Resources, Permissions.Actions[]>
  ) {
    const roleId = await PermissionManager.getRoleId(
      Permissions.Roles.ORGANIZATION_MANAGER
    );

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
}

class ProjectManager extends User {
  async create(
    userId: string,
    organizationId: string,
    permissions: Record<Permissions.Resources, Permissions.Actions[]>,
    projectId: string
  ) {
    const roleId = await PermissionManager.getRoleId(
      Permissions.Roles.PROJECT_MANAGER
    );

    if (!roleId) {
      throw new Error("Role not found");
    }

    await permissionsOps.createProjectPermissions(
      userId,
      projectId,
      organizationId,
      roleId,
      permissions
    );
  }
}

class ProjectMember extends User {
  async create(
    userId: string,
    organizationId: string,
    permissions: Record<Permissions.Resources, Permissions.Actions[]>,
    projectId: string
  ) {
    const roleId = await PermissionManager.getRoleId(
      Permissions.Roles.PROJECT_MEMBER
    );

    if (!roleId) {
      throw new Error("Role not found");
    }

    await permissionsOps.createProjectPermissions(
      userId,
      projectId,
      organizationId,
      roleId,
      permissions
    );
  }
}
