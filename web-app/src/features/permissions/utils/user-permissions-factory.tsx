import { OrganizationMemberRoleResponse, Permissions } from "../types";

export class UserPermissionsFactory {
  static create(userRole: OrganizationMemberRoleResponse): UserPermissions {
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
    const resourcePermissions = this.userRole.resources.find(
      (r) => r.name === resource
    );

    if (!resourcePermissions) {
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
