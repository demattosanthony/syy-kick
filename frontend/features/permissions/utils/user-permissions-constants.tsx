import { Permissions } from "../types";

const {
  Roles: {
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
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
}
