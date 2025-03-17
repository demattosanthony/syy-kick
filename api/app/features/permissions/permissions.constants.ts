import { Permissions } from "./permissions.types";

const {
  Resources: {
    ORGANIZATION,
    ORGANIZATION_INVITATIONS,
    ORGANIZATION_MEMBERS,
    ORGANIZATION_SEATS,
    ORGANIZATION_PROJECTS,
    ORGANIZATION_PROJECT_DOCS,
    ORGANIZATION_PROJECT_INVITATIONS,
    ORGANIZATION_PROJECT_MEMBERS,
  },
  Actions: { CREATE, READ, UPDATE, DELETE },
  Roles: {
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
  },
} = Permissions;

export default class Constants {
  static Access: Record<
    string,
    Record<Permissions.Resources, Permissions.Actions[]>
  > = {
    [ORGANIZATION_ADMIN]: {
      [ORGANIZATION]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_SEATS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECTS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
    },
    [ORGANIZATION_MANAGER]: {
      [ORGANIZATION]: [READ, UPDATE],
      [ORGANIZATION_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_SEATS]: [READ],
      [ORGANIZATION_PROJECTS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
    },
    [PROJECT_MANAGER]: {
      [ORGANIZATION]: [READ],
      [ORGANIZATION_INVITATIONS]: [], // No access
      [ORGANIZATION_MEMBERS]: [], // No access
      [ORGANIZATION_SEATS]: [], // No access
      [ORGANIZATION_PROJECTS]: [READ], // Config
      [ORGANIZATION_PROJECT_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_PROJECT_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
    },
    [PROJECT_MEMBER]: {
      [ORGANIZATION]: [READ],
      [ORGANIZATION_INVITATIONS]: [], // No access
      [ORGANIZATION_MEMBERS]: [], // No access
      [ORGANIZATION_SEATS]: [], // No access
      [ORGANIZATION_PROJECTS]: [READ], // Config
      [ORGANIZATION_PROJECT_DOCS]: [READ], // Config
      [ORGANIZATION_PROJECT_INVITATIONS]: [], // Config
      [ORGANIZATION_PROJECT_MEMBERS]: [], // Config
    },
  };

  static ConfigurableRolesResources: Record<
    string,
    Record<
      Permissions.Resources,
      Record<Permissions.Actions, { default: boolean; configurable: boolean }>
    >
  > = {
    [ORGANIZATION_ADMIN]: {
      [ORGANIZATION]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_INVITATIONS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_MEMBERS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_SEATS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECTS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_INVITATIONS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_MEMBERS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
    },
    [ORGANIZATION_MANAGER]: {
      [ORGANIZATION]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_INVITATIONS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_MEMBERS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_SEATS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_PROJECTS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_INVITATIONS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_MEMBERS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
    },
    [PROJECT_MANAGER]: {
      [ORGANIZATION]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_INVITATIONS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_MEMBERS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_SEATS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_PROJECTS]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
      [ORGANIZATION_PROJECT_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_INVITATIONS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_PROJECT_MEMBERS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
    },
    [PROJECT_MEMBER]: {
      [ORGANIZATION]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_INVITATIONS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_MEMBERS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_SEATS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: false, configurable: false },
        [UPDATE]: { default: false, configurable: false },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_PROJECTS]: {
        [CREATE]: { default: false, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_PROJECT_DOCS]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: false, configurable: true },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
      [ORGANIZATION_PROJECT_INVITATIONS]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: false, configurable: true },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
      [ORGANIZATION_PROJECT_MEMBERS]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: false, configurable: true },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
    },
  };

  static RoleHierarchy: Permissions.Roles[] = [
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
  ];
}
