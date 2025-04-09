export namespace Permissions {
  export enum Roles {
    SUPER_ADMIN = "SUPER_ADMIN",
    ORGANIZATION_ADMIN = "ORGANIZATION_ADMIN",
    ORGANIZATION_MANAGER = "ORGANIZATION_MANAGER",
    PROJECT_MANAGER = "PROJECT_MANAGER",
    PROJECT_MEMBER = "PROJECT_MEMBER",
  }

  export enum Actions {
    CREATE = "create",
    READ = "read",
    UPDATE = "update",
    DELETE = "delete",
  }

  export enum Resources {
    ORGANIZATION = "org",
    ORGANIZATION_INVITATIONS = "org_invitations",
    ORGANIZATION_MEMBERS = "org_members",
    ORGANIZATION_SEATS = "org_seats",
    ORGANIZATION_SITES = "org_sites",
    ORGANIZATION_PROJECTS = "org_projects",
    ORGANIZATION_PROJECT_DOCS = "org_project_docs",
    ORGANIZATION_PROJECT_INVITATIONS = "org_project_invitations",
    ORGANIZATION_PROJECT_MEMBERS = "org_project_members",
    ORGANIZATION_KNOWLEDGE_BASES = "org_knowledge_bases",
    ORGANIZATION_KNOWLEDGE_BASES_DOCS = "org_knowledge_bases_docs",
    PROJECT_ISSUES = "project_issues",
  }

  export enum Level {
    ORGANIZATION = "organization",
    PROJECT = "project",
  }
}

export interface Role {
  id: string;
  name: Permissions.Roles;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resource {
  id: string;
  name: Permissions.Resources;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Action {
  id: string;
  name: Permissions.Actions;
}

export interface Permission {
  id: string;
  roleId: string;
  resourceId: string;
  actionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TransferableProject = {
  id: string;
  name: string;
};

export type TransferableProjectsResponse = TransferableProject[];

export type TransferableRolesResource = {
  id: string;
  name: string;
  actions: {
    id: string;
    name: string;
    default: boolean;
    configurable: boolean;
  }[];
};

export type TransferableRolesPermissions = {
  id: string;
  name: string;
  resources: TransferableRolesResource[];
}[];

export interface ResourcePermissions {
  id: string;
  name: Permissions.Resources;
  actions: Action[];
}

export interface OrganizationMemberRoleResponse {
  id: string;
  organizationId: string;
  role: Role;
  resources: ResourcePermissions[];
  projects?: { id: string; name: string }[];
}

export type RolesResponse = Role[];

export type OrgInvitationRequestItem = {
  roleId: string;
  email: string;
};

export type OrgInvitationsRequest = OrgInvitationRequestItem[];

export interface OrgMember {
  id: string;
  email: string;
  name: string;
  role: Role;
  profilePicture?: string;
  canUpdate: boolean;
  canDelete: boolean;
  createdAt: Date;
}

export type OrgMemberResponse = OrgMember[];

export type OrgInvitationResponseItem = OrgMember & {
  link: string;
  name: undefined;
};

export type OrgInvitationsResponse = OrgInvitationResponseItem[];

export type UpdateOrgMemberRoleRequest = {
  resources: Record<string, string[]>; // resourceId: actionId[]
  roleId: string;
  projectIds?: string[];
};
