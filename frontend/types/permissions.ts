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
    ORGANIZATION_PROJECTS = "org_projects",
    ORGANIZATION_PROJECT_DOCS = "org_project_docs",
    ORGANIZATION_PROJECT_INVITATIONS = "org_project_invitations",
    ORGANIZATION_PROJECT_MEMBERS = "org_project_members",
  }
}
