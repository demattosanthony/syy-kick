import { Permissions } from "./permissions.types";

const {
  Resources: {
    ORGANIZATION,
    ORGANIZATION_INVITATIONS,
    ORGANIZATION_MEMBERS,
    ORGANIZATION_SEATS,
    ORGANIZATION_ACCESS_LOGS,
    ORGANIZATION_KNOWLEDGE_BASES,
    ORGANIZATION_KNOWLEDGE_BASES_DOCS,
    ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS,
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
      [ORGANIZATION_ACCESS_LOGS]: [READ],
      [ORGANIZATION_KNOWLEDGE_BASES]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: [READ],
    },
    [ORGANIZATION_MANAGER]: {
      [ORGANIZATION]: [READ, UPDATE],
      [ORGANIZATION_INVITATIONS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_MEMBERS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_SEATS]: [READ],
      [ORGANIZATION_ACCESS_LOGS]: [READ],
      [ORGANIZATION_KNOWLEDGE_BASES]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: [READ],
    },
    [PROJECT_MANAGER]: {
      [ORGANIZATION]: [READ],
      [ORGANIZATION_INVITATIONS]: [], // No access
      [ORGANIZATION_MEMBERS]: [], // No access
      [ORGANIZATION_SEATS]: [], // No access
      [ORGANIZATION_ACCESS_LOGS]: [], // No access
      [ORGANIZATION_KNOWLEDGE_BASES]: [READ], // Config
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: [CREATE, READ, UPDATE, DELETE],
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: [], // No access
    },
    [PROJECT_MEMBER]: {
      [ORGANIZATION]: [READ],
      [ORGANIZATION_INVITATIONS]: [], // No access
      [ORGANIZATION_MEMBERS]: [], // No access
      [ORGANIZATION_SEATS]: [], // No access
      [ORGANIZATION_ACCESS_LOGS]: [], // No access
      [ORGANIZATION_KNOWLEDGE_BASES]: [READ], // Config
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: [READ], // Config
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: [], // No access
    },
  };

  static ConfigurableRolesResources: Record<
    string,
    Record<
      Permissions.Resources,
      Partial<
        Record<Permissions.Actions, { default: boolean; configurable: boolean }>
      >
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
      [ORGANIZATION_ACCESS_LOGS]: {
        [READ]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: {
        [READ]: { default: true, configurable: false },
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
      [ORGANIZATION_ACCESS_LOGS]: {
        [READ]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: {
        [READ]: { default: true, configurable: false },
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
      [ORGANIZATION_ACCESS_LOGS]: {
        [READ]: { default: false, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: {
        [CREATE]: { default: true, configurable: false },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: true, configurable: false },
        [DELETE]: { default: true, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: {
        [READ]: { default: false, configurable: false },
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
      [ORGANIZATION_ACCESS_LOGS]: {
        [READ]: { default: false, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: false },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_DOCS]: {
        [CREATE]: { default: false, configurable: true },
        [READ]: { default: true, configurable: false },
        [UPDATE]: { default: false, configurable: true },
        [DELETE]: { default: false, configurable: true },
      },
      [ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS]: {
        [READ]: { default: false, configurable: false },
      },
    },
  };

  static OrganizationResources: Permissions.Resources[] = [
    ORGANIZATION,
    ORGANIZATION_INVITATIONS,
    ORGANIZATION_MEMBERS,
    ORGANIZATION_SEATS,
    ORGANIZATION_ACCESS_LOGS,
  ];

  static OrganizationKnowledgeBaseResources: Permissions.Resources[] = [
    ORGANIZATION_KNOWLEDGE_BASES,
    ORGANIZATION_KNOWLEDGE_BASES_DOCS,
    ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS,
  ];

  static RoleHierarchy: Permissions.Roles[] = [
    SUPER_ADMIN,
    ORGANIZATION_ADMIN,
    ORGANIZATION_MANAGER,
    PROJECT_MANAGER,
    PROJECT_MEMBER,
  ];
}
