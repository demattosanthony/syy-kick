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
  actions,
  organizationMemberRoles,
  permissions,
  projectMemberRoles,
  projects,
  resources,
  roles,
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
    organizationMemberId: string;
    role: Role;
  } | null> => {
    const organizationMemberRole =
      await db.query.organizationMemberRoles.findFirst({
        where: and(
          eq(organizationMemberRoles.organizationId, organizationId),
          eq(organizationMemberRoles.organizationMemberId, userId)
        ),
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
   * Gets the user's project role in a project
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
  ): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    roleId: string;
    userId: string;
    role: Role;
  } | null> => {
    const projectMemberRole = await db.query.projectMemberRoles.findFirst({
      where: and(
        eq(projectMemberRoles.projectId, projectId),
        eq(projectMemberRoles.userId, userId)
      ),
      with: {
        role: true,
      },
    });

    if (!projectMemberRole) {
      return null;
    }

    return projectMemberRole;
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
   * @param {object} orgRole - The user organization role
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
    // @TODO better type and member id management
    orgOrProjectRole: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      organizationId: string;
      roleId: string;
      organizationMemberId?: string;
      userId?: string;
      role: Role;
    },
    resourceId: string,
    actionName: string
  ): Promise<boolean> {
    const actionId = await this.getActionId(actionName);

    if (!actionId) {
      return false;
    }

    let entityCondition;

    if (
      level === Permissions.Level.ORGANIZATION &&
      [
        Permissions.Roles.ORGANIZATION_ADMIN,
        Permissions.Roles.ORGANIZATION_MANAGER,
      ].includes(orgOrProjectRole.role.name as Permissions.Roles)
    ) {
      entityCondition = eq(permissions.orgMemberRoleId, orgOrProjectRole.id);
    } else {
      entityCondition = eq(
        permissions.projectMemberRoleId,
        orgOrProjectRole.id
      );
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
      projects: [],
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
   * Checks if a user is a project member
   * @param {string} userId - The user ID
   * @param {string} projectId - The project ID
   * @returns {Promise<boolean>} - True if the user is a project member, false otherwise
   * @memberof PermissionManager
   * @example
   * const isProjectMember = await PermissionManager.isUserProject("user-id", "project-id");
   * console.log(isProjectMember); // true
   **/
  static async isUserProject(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    });

    return !!project;
  }

  static async getUserOrgProjectsIds(
    userId: string,
    orgId: string
  ): Promise<string[]> {
    const userRole = await db.query.organizationMemberRoles.findFirst({
      where: and(
        eq(organizationMemberRoles.organizationId, orgId),
        eq(organizationMemberRoles.organizationMemberId, userId)
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
      const organizationProjects = await db.query.projects.findMany({
        where: eq(projects.organizationId, orgId),
      });

      return organizationProjects.map((project) => project.id);
    }

    if (
      [
        Permissions.Roles.PROJECT_MANAGER,
        Permissions.Roles.PROJECT_MEMBER,
      ].includes(userRole.role.name as Permissions.Roles)
    ) {
      const projectsList = await db.query.projectMemberRoles.findMany({
        where: and(
          eq(projectMemberRoles.userId, userId),
          eq(projectMemberRoles.organizationId, orgId)
        ),
      });

      console.log(projectsList, '<--- project list');

      return projectsList.map((project) => project.projectId);
    }

    return [];
  }
}
