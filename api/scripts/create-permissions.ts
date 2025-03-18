import { eq } from "drizzle-orm";
import db from "../app/config/db";
import {
  actions,
  organizationInvites,
  organizationMembers,
  memberRoles,
  permissions,
  resources,
  roles,
} from "../app/config/schema";
import { Permissions } from "../app/features/permissions/permissions.types";

await db.insert(roles).values([
  {
    name: Permissions.Roles.SUPER_ADMIN,
    description: "Administers the entire application",
  },
  {
    name: Permissions.Roles.ORGANIZATION_ADMIN,
    description: "Administers the entire organization",
  },
  {
    name: Permissions.Roles.ORGANIZATION_MANAGER,
    description: "Manages projects and resources within the organization",
  },
  {
    name: Permissions.Roles.PROJECT_MANAGER,
    description: "Manages specific projects and their members",
  },
  {
    name: Permissions.Roles.PROJECT_MEMBER,
    description: "Participates in projects with limited permissions",
  },
]);

await db.insert(resources).values([
  {
    name: Permissions.Resources.ORGANIZATION,
    description: "The organization itself",
  },
  {
    name: Permissions.Resources.ORGANIZATION_INVITATIONS,
    description: "Invitations to join the organization",
  },
  {
    name: Permissions.Resources.ORGANIZATION_MEMBERS,
    description: "Members of the organization",
  },
  {
    name: Permissions.Resources.ORGANIZATION_SEATS,
    description: "Seats management of the organization",
  },
  {
    name: Permissions.Resources.ORGANIZATION_PROJECTS,
    description: "Projects within the organization",
  },
  {
    name: Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
    description: "Documents within projects",
  },
  {
    name: Permissions.Resources.ORGANIZATION_PROJECT_INVITATIONS,
    description: "Project invitations",
  },
  {
    name: Permissions.Resources.ORGANIZATION_PROJECT_MEMBERS,
    description: "Members of the project",
  },
]);

await db.insert(actions).values([
  {
    name: Permissions.Actions.CREATE,
    description: "Create a new resource",
  },
  {
    name: Permissions.Actions.READ,
    description: "Read an existing resource",
  },
  {
    name: Permissions.Actions.UPDATE,
    description: "Update an existing resource",
  },
  {
    name: Permissions.Actions.DELETE,
    description: "Delete an existing resource",
  },
]);

// Remove existing organization invites
await db.delete(organizationInvites);

// Get all roles, resources, and actions
const [rolesList, resourcesList, actionsList] = await Promise.all([
  db.select().from(roles),
  db.select().from(resources),
  db.select().from(actions),
]);

const findIdByName = (
  list: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[],
  name: string
) => list.find((item) => item.name === name)?.id;

const orgAdminRoleId = findIdByName(
  rolesList,
  Permissions.Roles.ORGANIZATION_ADMIN
);

const orgManagerRoleId = findIdByName(
  rolesList,
  Permissions.Roles.ORGANIZATION_MANAGER
);

if (!orgAdminRoleId || !orgManagerRoleId) {
  console.error("Required roles not found");
  process.exit(1);
}

const readActionId = findIdByName(actionsList, Permissions.Actions.READ);
const updateActionId = findIdByName(actionsList, Permissions.Actions.UPDATE);
const createActionId = findIdByName(actionsList, Permissions.Actions.CREATE);
const deleteActionId = findIdByName(actionsList, Permissions.Actions.DELETE);

if (!readActionId || !updateActionId || !createActionId || !deleteActionId) {
  console.error("Required actions not found");
  process.exit(1);
}

// Insert existing organization owners as ORGANIZATION_ADMIN
const orgOwners = await db.query.organizationMembers.findMany({
  where: eq(organizationMembers.role, "owner"),
});

for (const owner of orgOwners) {
  await db.insert(memberRoles).values({
    userId: owner.userId,
    roleId: orgAdminRoleId,
    organizationId: owner.organizationId,
  });
}

// Insert existing organization member as ORGANIZATION_MANAGER
const orgMembers = await db.query.organizationMembers.findMany({
  where: eq(organizationMembers.role, "member"),
});

for (const member of orgMembers) {
  await db.insert(memberRoles).values({
    userId: member.userId,
    roleId: orgManagerRoleId,
    organizationId: member.organizationId,
  });
}

// Permissions ORGANIZATION_ADMIN
const orgMemberRoles = await db.query.memberRoles.findMany({
  where: eq(memberRoles.roleId, orgAdminRoleId),
});

for (const orgRole of orgMemberRoles) {
  let values = [];
  for (const resource of resourcesList) {
    for (const action of actionsList) {
      values.push({
        memberRoleId: orgRole.id,
        resourceId: resource.id,
        actionId: action.id,
      });
    }
  }

  if (values.length > 0) {
    await db.insert(permissions).values(values);
  }
}

// Permissions ORGANIZATION_MANAGER
const orgManagerRoles = await db.query.memberRoles.findMany({
  where: eq(memberRoles.roleId, orgManagerRoleId),
});

for (const orgRole of orgManagerRoles) {
  let values = [];
  for (const resource of resourcesList) {
    for (const action of actionsList) {
      if (
        resource.name === Permissions.Resources.ORGANIZATION &&
        [Permissions.Actions.CREATE, Permissions.Actions.DELETE].includes(
          action.name as Permissions.Actions
        )
      ) {
        continue;
      }

      if (
        resource.name === Permissions.Resources.ORGANIZATION_SEATS &&
        [
          Permissions.Actions.CREATE,
          Permissions.Actions.UPDATE,
          Permissions.Actions.DELETE,
        ].includes(action.name as Permissions.Actions)
      ) {
        continue;
      }

      values.push({
        memberRoleId: orgRole.id,
        resourceId: resource.id,
        actionId: action.id,
      });
    }
  }

  if (values.length > 0) {
    await db.insert(permissions).values(values);
  }
}
