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
    ORGANIZATION_ACCESS_LOGS = "org_access_logs",
  }

  export enum Level {
    ORGANIZATION = "organization",
    PROJECT = "project",
  }

  export enum Status {
    AUTHORIZED = "authorized",
    UNAUTHORIZED = "unauthorized",
  }
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resource {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  roleId: string;
  resourceId: string;
  actionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserPermissions = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  memberRoleId: string;
  resourceId: string;
  actionId: string;
  resource: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  action: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}[];

export interface RawUserRole {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  role: Role;
  permissions: UserPermissions;
}

export type UserRole = {
  id: string;
  role: Role;
  resources: {
    id: string;
    name: string;
    actions: {
      id: string;
      name: string;
    }[];
  }[];
};

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
