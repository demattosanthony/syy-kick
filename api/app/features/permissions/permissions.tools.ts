import { and, eq, inArray } from "drizzle-orm";
import db from "../../config/db";
import {
  OrganizationMemberRole,
  Permissions,
  ProjectMemberRole,
  TransferableRolesPermissions,
  TransferableRolesResource,
  UserOrganizationRole,
  UserProjectRole,
  UserRole,
} from "./permissions.types";
import {
  actions,
  organizationMemberRoles,
  permissions,
  projectMemberRoles,
  resources,
  roles,
} from "../../config/schema";
import { permissionsOps } from "./permissions.ops";
import Constants from "./permissions.constants";

export class PermissionManager {
  /**
   * Gets the user's role id in an organization
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
  ): Promise<string | null> => {
    const organizationMemberRole =
      await db.query.organizationMemberRoles.findFirst({
        where: and(
          eq(organizationMemberRoles.organizationId, organizationId),
          eq(organizationMemberRoles.organizationMemberId, userId)
        ),
      });

    if (!organizationMemberRole) {
      return null;
    }

    return organizationMemberRole.id;
  };

  /**
   * Gets the user's role id in a project
   * @param {string} userId - The user ID
   * @param {string} projectId - The project ID
   * @returns {Promise<string | null>} - The role ID or null if the user is not a member
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const role = await permissionManager
   *  .getUserProjectRole("user-id", "project-id")
   * ;
   **/
  getUserProjectRole = async (
    userId: string,
    projectId: string
  ): Promise<string | null> => {
    const projectMemberRole = await db.query.projectMemberRoles.findFirst({
      where: and(
        eq(projectMemberRoles.projectId, projectId),
        eq(projectMemberRoles.userId, userId)
      ),
    });

    if (!projectMemberRole) {
      return null;
    }

    return projectMemberRole.id;
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
  getActionId = async (actionName: string): Promise<string | null> => {
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
   * @param {Permissions.Level} level - The permission level (organization or project)
   * @param {string} roleId - The user role ID
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
  async userHasAccessToRessource(
    level: Permissions.Level,
    roleId: string,
    resourceId: string,
    actionName: string
  ): Promise<boolean> {
    const actionId = await this.getActionId(actionName);

    if (!actionId) {
      return false;
    }

    let entityCondition;

    if (level === Permissions.Level.ORGANIZATION) {
      entityCondition = eq(permissions.orgMemberRoleId, roleId);
    } else {
      entityCondition = eq(permissions.projectMemberRoleId, roleId);
    }

    const permission = await db.query.permissions.findFirst({
      where: and(
        entityCondition,
        eq(permissions.resourceId, resourceId),
        eq(permissions.actionId, actionId)
      ),
    });

    return !!permission;
  }

  /**
   * Verifies if a user can configure a resource action
   * @param {Permissions.Roles} role - The user role
   * @param {Permissions.Resources} resource - The resource to check access
   * @param {Permissions.Actions} action - The action name (e.g. Create, Read, Update, Delete)
   * @param {Permissions.Actions[]} userResourcePermissions - The user's permissions for the resource
   * @returns {boolean} - True if the user has access, false otherwise
   * @memberof PermissionManager
   * @example
   * const userCanConfigResourceAction = PermissionManager.userCanConfigResourceAction(
   *  Permissions.Roles.ORGANIZATION_ADMIN,
   *  Permissions.Resources.ORGANIZATION,
   *  Permissions.Actions.UPDATE,
   *  ["create", "read", "update", "delete"]
   * );
   */
  static userCanConfigResourceAction = (
    role: Permissions.Roles,
    resource: Permissions.Resources,
    action: Permissions.Actions,
    userResourcePermissions: Permissions.Actions[]
  ): boolean => {
    return (
      Constants.ConfigurableRolesResources[role][resource][action]
        .configurable && userResourcePermissions.includes(action)
    );
  };

  /**
   * Gets the transferable roles for a user
   * @param {string} userId - The user ID
   * @param {Permissions.Level} level - The permission level (organization or project)
   * @param {string} entityId - The organization or project ID
   * @returns {Promise<Record<string, Record<Permissions.Resources, Permissions.Actions[]>> | null>} - The transferable roles or null if the user cannot transfer roles
   * @memberof PermissionManager
   * @example
   * const permissionManager = new PermissionManager();
   * const transferableRoles = await permissionManager
   *  .getUserTransferableRoles("user-id", Permissions.Level.ORGANIZATION, "project-id")
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

    // Récupération du rôle utilisateur avec toutes ses permissions en une seule requête
    const userRole =
      level === Permissions.Level.ORGANIZATION
        ? await permissionsOps.getUserOrganizationRole(userId, entityId)
        : await permissionsOps.getUserProjectRole(userId, entityId);

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

  static formatUserRole = (
    role: OrganizationMemberRole | ProjectMemberRole
  ): UserOrganizationRole | UserProjectRole => {
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

    const userRole: UserRole = {
      id: role.id,
      role: role.role,
      resources: Object.values(resources),
    };

    if ("organizationId" in role) {
      return {
        ...userRole,
        organizationId: role.organizationId,
      };
    }

    return {
      ...userRole,
      projectId: role.projectId,
    };
  };

  /**
   * Checks if a user can update a role
   * @param {Permissions.Roles} userRole - The user role
   * @param {Permissions.Roles} role - The role to update
   * @returns {boolean} - True if the user can update the role, false otherwise
   * @memberof PermissionManager
   * @example
   * const canUpdateRole = PermissionManager.canUpdateRole(
   *  Permissions.Roles.ORGANIZATION_ADMIN,
   *  Permissions.Roles.ORGANIZATION_MANAGER
   * );
   * console.log(canUpdateRole); // true
   **/
  static canUpdateRole = (
    userRole: Permissions.Roles,
    role: Permissions.Roles
  ): boolean => {
    return (
      Constants.RoleHierarchy.indexOf(userRole) <
      Constants.RoleHierarchy.indexOf(role)
    );
  };
}
