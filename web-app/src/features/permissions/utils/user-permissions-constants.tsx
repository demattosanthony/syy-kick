import { Permissions } from "../types";

const {
  Roles: {
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
  },
  Resources: {
    ORGANIZATION,
    ORGANIZATION_INVITATIONS,
    ORGANIZATION_MEMBERS,
    ORGANIZATION_SEATS,
    ORGANIZATION_ACCESS_LOGS,
  },
} = Permissions;

export default class Constants {
  static RoleHierarchy: Permissions.Roles[] = [
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
  ];

  static OrganizationResources: Permissions.Resources[] = [
    ORGANIZATION,
    ORGANIZATION_INVITATIONS,
    ORGANIZATION_MEMBERS,
    ORGANIZATION_SEATS,
    ORGANIZATION_ACCESS_LOGS,
  ];
}
