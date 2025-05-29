import { and, eq, inArray } from "drizzle-orm";
import db from "../../config/db";
import {
  Permissions,
  RawUserRole,
  Role,
  TransferableRolesPermissions,
  TransferableRolesResource,
  UserRole,
} from "./permissions.types";
import {
  accessLogs,
  actions,
  memberRoles,
  permissions,
  resources,
  roles,
  sites,
} from "../../config/schema";
import { permissionsOps } from "./permissions.ops";
import Constants from "./permissions.constants";

export class PermissionManager {
  /**
   * Gets the user's role in an organization
   * @param {string} userId - The user ID
   * @param {string} organizationId - The organization ID
   * @returns {Promise<string | null>} - The role ID or null if the user is not a member
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const role = await permissionManager
   *  .getUserOrganisationRole("user-id", "organization-id")
   * ;
   **/
  static getUserOrganisationRole = async (
    userId: string,
    organizationId: string
  ): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    roleId: string;
    userId: string;
    role: Role;
  } | null> => {
    const organizationMemberRole = await db.query.memberRoles.findFirst({
      where: eq(memberRoles.organizationId, organizationId),
      with: {
        role: true,
      },
    });

    if (!organizationMemberRole) {
      return null;
    }

    return organizationMemberRole;
  };

  /**
   * Gets the action ID from the action name
   * @param {string} actionName - The action name
   * @returns {Promise<string | null>} - The action ID or null if the action does not exist
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const actionId = await permissionManager
   *  .getActionId("action-name")
   * ;
   **/
  static getActionId = async (actionName: string): Promise<string | null> => {
    const action = await db.query.actions.findFirst({
      where: eq(actions.name, actionName),
    });

    if (!action) {
      return null;
    }

    return action.id;
  };

  /**
   * Gets the role ID from the role name
   * @param {Permissions.Roles} roleName - The role name
   * @returns {Promise<string | null>} - The role ID or null if the role does not exist
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const roleId = await permissionManager
   *  .getRoleId(Permissions.Roles.ORGANIZATION_ADMIN)
   * ;
   **/
  static getRoleId = async (
    roleName: Permissions.Roles
  ): Promise<string | null> => {
    const role = await db.query.roles.findFirst({
      where: eq(roles.name, roleName),
    });

    if (!role) {
      return null;
    }

    return role.id;
  };

  /**
   * Gets the resource ID from the resource name
   * @param {string} resourceName - The resource name
   * @returns {Promise<string | null>} - The resource ID or null if the resource does not exist
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const resourceId = await permissionManager
   *  .getResourseId("resource-name")
   * ;
   **/
  static getResourseId = async (
    resourceName: string
  ): Promise<string | null> => {
    const resource = await db.query.resources.findFirst({
      where: eq(resources.name, resourceName),
    });

    if (!resource) {
      return null;
    }

    return resource.id;
  };

  /***
   * Verifies if a user has access to a resource
   * @param {object} orgMemberRole - The user organization role
   * @param {string} orgId - The organization ID
   * @param {Permissions.Resources} resourceId - The resource to check access
   * @param {Permissions.Actions} actionName - The action name (e.g. Create, Read, Update, Delete)
   * @returns {Promise<boolean>} - True if the user has access, false otherwise
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const hasAccess = await permissionManager
   *   .userHasAccess(
   *      Permissions.Level.ORGANIZATION,
   *      "role-id",
   *      "ressource-id",
   *      Permissions.Actions.READ
   *  );
   */
  static async userHasAccessToRessource(
    orgMemberRole: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      organizationId: string;
      roleId: string;
      userId: string;
      role: Role;
    },
    orgId: string,
    resourceId: string,
    actionName: string
  ): Promise<boolean> {
    const actionId = await PermissionManager.getActionId(actionName);

    if (!actionId) {
      return false;
    }

    const orgPermission = await db.query.permissions.findFirst({
      where: and(
        eq(permissions.memberRoleId, orgMemberRole.id),
        eq(permissions.resourceId, resourceId),
        eq(permissions.actionId, actionId)
      ),
    });

    return !!orgPermission;
  }

  /**
   * Gets the transferable roles for a user
   * @param {string} userId - The user ID
   * @param {Permissions.Level} level - The permission level (organization only)
   * @param {string} entityId - The organization ID
   * @returns {Promise<Record<string, Record<Permissions.Resources, Permissions.Actions[]>> | null>} - The transferable roles or null if the user cannot transfer roles
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const transferableRoles = await permissionManager
   *  .getUserTransferableRoles("user-id", Permissions.Level.ORGANIZATION, "organization-id")
   * ;
   **/
  static async getUserTransferableRoles(
    userId: string,
    level: Permissions.Level,
    entityId: string
  ): Promise<TransferableRolesPermissions> {
    if (!entityId) {
      return [];
    }

    // Get the user role in the organization, with resources permissions
    const userRole = await permissionsOps.getUserOrganizationRole(
      userId,
      entityId
    );

    if (!userRole) {
      return [];
    }

    // Roles hierarchy
    const roleHierarchy: Permissions.Roles[] = [
      Permissions.Roles.PROJECT_MANAGER,
      Permissions.Roles.PROJECT_MEMBER,
    ];

    if (level === Permissions.Level.ORGANIZATION) {
      roleHierarchy.unshift(
        Permissions.Roles.ORGANIZATION_ADMIN,
        Permissions.Roles.ORGANIZATION_MANAGER
      );
    }

    const userRoleIndex = roleHierarchy.indexOf(
      userRole.role.name as Permissions.Roles
    );

    const transferableRolesNames = roleHierarchy.slice(userRoleIndex + 1);

    const [transferableRoles, allResources, allActions] = await Promise.all([
      db.query.roles.findMany({
        where: inArray(roles.name, transferableRolesNames),
      }),
      db.query.resources.findMany(),
      db.query.actions.findMany(),
    ]);

    const resourcesMap = new Map(allResources.map((res) => [res.name, res]));
    const actionsMap = new Map(allActions.map((act) => [act.name, act]));

    // Set of user permissions
    const userPermissionsSet = new Set(
      userRole.permissions.map(
        (perm) => `${perm.resource.name}:${perm.action.name}`
      )
    );

    // For each transferable role
    const transferablePermissions: TransferableRolesPermissions =
      transferableRoles.map((role) => {
        const roleConfig = Constants.ConfigurableRolesResources[role.name];
        const roleResources: TransferableRolesResource[] = [];

        // For each resource in the role config
        for (const [resourceName, actionsConfig] of Object.entries(
          roleConfig
        )) {
          const resource = resourcesMap.get(resourceName);
          if (!resource) continue;

          // For each action in the resource config
          const resourceActions = Object.entries(actionsConfig)
            .map(([actionName, config]) => {
              const action = actionsMap.get(actionName);
              if (!action) return null;

              const permissionKey = `${resourceName}:${actionName}`;
              // Check if the user has the permission
              const userHasPermission = userPermissionsSet.has(permissionKey);

              return {
                id: action.id,
                name: action.name,
                default: config.default,
                configurable: config.configurable && userHasPermission, // Configurable if the resource action is configurable AND the user has the permission
              };
            })
            .filter(
              (action) => action !== null
            ) as TransferableRolesResource["actions"];

          if (resourceActions.length > 0) {
            roleResources.push({
              id: resource.id,
              name: resource.name,
              actions: resourceActions,
            });
          }
        }

        return {
          id: role.id,
          name: role.name,
          resources: roleResources,
        };
      });

    return transferablePermissions;
  }

  /**
   * Formats a raw user role to a user role
   * @param {RawUserRole} role - The raw user role
   * @returns {UserRole} - The formatted user role
   * @memberof PermissionManager
   * @example
   * const permissionManager = PermissionManager.formatUserRole(rawUserRole);
   **/
  static formatUserRole = (role: RawUserRole): UserRole => {
    const resources: any = [];

    role.permissions.forEach((permission) => {
      if (!resources[permission.resource.id]) {
        resources[permission.resource.id] = {
          id: permission.resource.id,
          name: permission.resource.name,
          actions: [
            {
              id: permission.action.id,
              name: permission.action.name,
            },
          ],
        };
      } else {
        resources[permission.resource.id].actions.push({
          id: permission.action.id,
          name: permission.action.name,
        });
      }
    });

    return {
      id: role.id,
      role: role.role,
      resources: Object.values(resources),
    };
  };

  /**
   * Checks if a user has superior role
   * @param {Permissions.Roles} userRole - The user role
   * @param {Permissions.Roles} role - The role to check
   * @returns {boolean} - True if the user has superior role, false otherwise
   * @memberof PermissionManager
   * @example
   * const hasSuperiorRole = PermissionManager.hasSuperiorRole(
   *  Permissions.Roles.ORGANIZATION_ADMIN,
   *  Permissions.Roles.ORGANIZATION_MANAGER
   * );
   * console.log(hasSuperiorRole); // true
   **/
  static hasSuperiorRole = (
    userRole: Permissions.Roles,
    role: Permissions.Roles
  ): boolean => {
    return (
      Constants.RoleHierarchy.indexOf(userRole) <
      Constants.RoleHierarchy.indexOf(role)
    );
  };

  /**
   * Converts permission names to IDs
   * @param {Record<Permissions.Resources, Permissions.Actions[]>} permissions - The permissions to convert
   * @returns {Promise<Record<string, string[]>} - The permissions with IDs
   * @memberof PermissionManager
   * @example
   * const permissions = await PermissionManager.permissionsNamesToIds({
   *  [Permissions.Resources.ORGANIZATION]: [Permissions.Actions.CREATE, Permissions.Actions.READ],
   *  [Permissions.Resources.ORGANIZATION_INVITATIONS]: [Permissions.Actions.CREATE, Permissions.Actions.READ],
   * });
   * console.log(permissions);
   **/
  static async permissionsNamesToIds(
    permissions: Record<Permissions.Resources, Permissions.Actions[]>
  ): Promise<Record<string, string[]>> {
    const resourceNames = Object.keys(permissions);
    const actionNames = [...new Set(Object.values(permissions).flat())];

    const resourceRows = await db
      .select({ id: resources.id, name: resources.name })
      .from(resources)
      .where(inArray(resources.name, resourceNames));

    const actionRows = await db
      .select({ id: actions.id, name: actions.name })
      .from(actions)
      .where(inArray(actions.name, actionNames));

    const resourceMap = Object.fromEntries(
      resourceRows.map((row) => [row.name, row.id])
    );
    const actionMap = Object.fromEntries(
      actionRows.map((row) => [row.name, row.id])
    );

    return Object.fromEntries(
      Object.entries(permissions).map(([resource, actionList]) => [
        resourceMap[resource],
        actionList.map((action) => actionMap[action]),
      ])
    );
  }

  /**
   * Checks if a site is owned by a user (would mean that it belongs to his personal workspace)
   * @param {string} userId - The user ID
   * @param {string} siteId - The site ID
   * @returns {Promise<boolean>} - True if the user owns the site, false otherwise
   * @memberof PermissionManager
   * @example
   * const isUserSite = await PermissionManager.isUserSite("user-id", "site-id");
   * console.log(isUserSite); // true
   **/
  static async isUserSite(userId: string, siteId: string): Promise<boolean> {
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
    });

    return !!site;
  }

  static async getUserSitesIds(
    userId: string,
    orgId: string
  ): Promise<string[]> {
    const userRole = await db.query.memberRoles.findFirst({
      where: and(
        eq(memberRoles.organizationId, orgId),
        eq(memberRoles.userId, userId)
      ),
      with: {
        role: true,
      },
    });

    if (!userRole) {
      return [];
    }

    if (
      [
        Permissions.Roles.ORGANIZATION_ADMIN,
        Permissions.Roles.ORGANIZATION_MANAGER,
      ].includes(userRole.role.name as Permissions.Roles)
    ) {
      const sitesList = await db.query.sites.findMany({
        where: eq(sites.organizationId, orgId),
      });

      return sitesList.map((site) => site.id);
    }

    return [];
  }

  /**
   * Get personnal workspace permissions (full access)
   * @returns {Promise<UserRole>} - The user's personnal workspace permissions
   * @memberof PermissionManager
   * @example
   * const personnalWorkspacePermissions = await PermissionManager.getPersonnalWorkspacePermissions();
   **/
  static async getPersonnalWorkspacePermissions(): Promise<UserRole> {
    const role = await db.query.roles.findFirst({
      where: eq(roles.name, Permissions.Roles.ORGANIZATION_ADMIN),
    });

    const resources = await db.query.resources.findMany();
    const actions = await db.query.actions.findMany();

    return {
      id: "personal-workspace",
      role: role as Role,
      resources: resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        actions: actions.map((action) => ({
          id: action.id,
          name: action.name,
        })),
      })),
    };
  }

  /**
   * Get the user's organization role resources permissions
   * @param {string} userId - The user ID
   * @param {string} orgId - The organization ID
   * @returns {Promise<Record<string, string[]>} - The user's organization role resources permissions
   * @memberof PermissionManager
   * @example
   * const orgRoleResourcesPermissions = await PermissionManager.getOrgRoleResourcesPermissions("user-id", "org-id");
   **/
  static async getOrgRoleResourcesPermissions(
    userId: string,
    orgId: string
  ): Promise<{
    role: Role;
    resources: Record<string, string[]>;
  }> {
    const userOrgRole = await permissionsOps.getUserOrganizationRole(
      userId,
      orgId
    );

    if (!userOrgRole) {
      throw new Error("User not found in organization");
    }

    const resourcesPermissions: Record<string, string[]> = {};

    userOrgRole.permissions.forEach((permission) => {
      if (!resourcesPermissions[permission.resourceId]) {
        resourcesPermissions[permission.resourceId] = [permission.actionId];
      } else {
        resourcesPermissions[permission.resourceId].push(permission.actionId);
      }
    });

    return {
      role: userOrgRole.role,
      resources: resourcesPermissions,
    };
  }

  /**
   * Logs a user's access to an organization, or document
   * @param {string} userId - The user ID
   * @param {Permissions.Actions} action - The action performed
   * @param {Permissions.Resources} resource - The resource accessed
   * @param {Permissions.Status} status - The status of the access
   * @param {string} organizationId - The organization ID (optional)
   * @param {string} documentId - The document ID (optional)
   * @memberof PermissionManager
   * @example
   * await PermissionManager.logAccess("user-id", Permissions.Actions.READ, Permissions.Resources.ORGANIZATION, "org-id");
   **/
  static async logAccess(
    userId: string,
    action: Permissions.Actions,
    resource: Permissions.Resources,
    status: Permissions.Status,
    identifiers: {
      organizationId?: string;
      documentId?: string;
      siteId?: string;
      knowledgeBaseId?: string;
    }
  ) {
    const actionId = await PermissionManager.getActionId(action);
    const resourceId = await PermissionManager.getResourseId(resource);

    if (!actionId || !resourceId) {
      throw new Error("Action or resource not found");
    }

    await db.insert(accessLogs).values({
      userId,
      organizationId: identifiers.organizationId,
      documentId: identifiers.documentId,
      actionId,
      resourceId,
      siteId: identifiers.siteId,
      knowledgeBaseId: identifiers.knowledgeBaseId,
      status,
    });
  }
}
