import { OrganizationMemberRoleResponse, Permissions } from "../types";

export class UserPermissionsFactory {
  static create(userRole: OrganizationMemberRoleResponse): UserPermissions {
    // Handle case where role might be missing or undefined
    if (!userRole.role || !userRole.role.name) {
      return new DefaultUserPermissions(userRole);
    }

    switch (userRole.role.name) {
      case Permissions.Roles.SUPER_ADMIN:
        return new SuperAdminPermissions(userRole);
      default:
        return new DefaultUserPermissions(userRole);
    }
  }
}

export abstract class UserPermissions {
  protected userRole: OrganizationMemberRoleResponse;

  constructor(userRole: OrganizationMemberRoleResponse) {
    this.userRole = userRole;
  }

  abstract hasAccess(
    resource: Permissions.Resources,
    action: Permissions.Actions
  ): boolean;
}

export class DefaultUserPermissions extends UserPermissions {
  hasAccess(
    resource: Permissions.Resources,
    action: Permissions.Actions
  ): boolean {
    // Handle case where resources might be missing or undefined
    if (!this.userRole.resources || !Array.isArray(this.userRole.resources)) {
      return false;
    }

    const resourcePermissions = this.userRole.resources.find(
      (r) => r.name === resource
    );

    if (!resourcePermissions) {
      return false;
    }

    // Handle case where actions might be missing or undefined
    if (
      !resourcePermissions.actions ||
      !Array.isArray(resourcePermissions.actions)
    ) {
      return false;
    }

    return resourcePermissions.actions.some((a) => a.name === action);
  }
}

export class SuperAdminPermissions extends UserPermissions {
  hasAccess(): boolean {
    return true;
  }
}
