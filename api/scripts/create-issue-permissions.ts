import { eq } from "drizzle-orm";
import db from "../app/config/db";
import {
  actions,
  memberRoles,
  permissions,
  resources,
  roles,
} from "../app/config/schema";
import { Permissions } from "../app/features/permissions/permissions.types";
import Constants from "../app/features/permissions/permissions.constants";

// 1. Insert the new project issues resource
console.log("Adding project issues resource to the database...");
await db
  .insert(resources)
  .values([
    {
      name: Permissions.Resources.PROJECT_ISSUES,
      description: "Issues within projects",
    },
  ])
  .onConflictDoNothing(); // Avoid errors if script is run multiple times

// 2. Fetch the existing resources, roles, and actions
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

// 3. Get ID for the newly added project issues resource
const projectIssuesResourceId = findIdByName(
  resourcesList,
  Permissions.Resources.PROJECT_ISSUES
);

if (!projectIssuesResourceId) {
  console.error("Project issues resource not found after insertion/fetch");
  process.exit(1);
}

// 4. Get action IDs
const readActionId = findIdByName(actionsList, Permissions.Actions.READ);
const updateActionId = findIdByName(actionsList, Permissions.Actions.UPDATE);
const createActionId = findIdByName(actionsList, Permissions.Actions.CREATE);
const deleteActionId = findIdByName(actionsList, Permissions.Actions.DELETE);

if (!readActionId || !updateActionId || !createActionId || !deleteActionId) {
  console.error("Required actions not found");
  process.exit(1);
}

// 5. Get role IDs
const orgAdminRoleId = findIdByName(
  rolesList,
  Permissions.Roles.ORGANIZATION_ADMIN
);
const orgManagerRoleId = findIdByName(
  rolesList,
  Permissions.Roles.ORGANIZATION_MANAGER
);
const projectManagerRoleId = findIdByName(
  rolesList,
  Permissions.Roles.PROJECT_MANAGER
);
const projectMemberRoleId = findIdByName(
  rolesList,
  Permissions.Roles.PROJECT_MEMBER
);

if (
  !orgAdminRoleId ||
  !orgManagerRoleId ||
  !projectManagerRoleId ||
  !projectMemberRoleId
) {
  console.error("Required roles not found");
  process.exit(1);
}

// 6. Process each role and add permissions according to the Constants file
async function addPermissionsForRole(roleId: string, roleName: string) {
  const memberRolesList = await db.query.memberRoles.findMany({
    where: eq(memberRoles.roleId, roleId),
  });

  console.log(
    `Adding permissions for ${roleName} (${memberRolesList.length} members) for PROJECT_ISSUES`
  );

  // Make sure required IDs are defined
  if (
    !projectIssuesResourceId ||
    !createActionId ||
    !readActionId ||
    !updateActionId ||
    !deleteActionId
  ) {
    console.error("Required resource or action IDs are undefined");
    return;
  }

  const permissionsToInsert: {
    memberRoleId: string;
    resourceId: string;
    actionId: string;
  }[] = [];
  const roleAccess = Constants.Access[roleName];

  for (const memberRole of memberRolesList) {
    const requiredActions =
      roleAccess[Permissions.Resources.PROJECT_ISSUES] || [];

    if (requiredActions.includes(Permissions.Actions.CREATE)) {
      permissionsToInsert.push({
        memberRoleId: memberRole.id,
        resourceId: projectIssuesResourceId,
        actionId: createActionId,
      });
    }
    if (requiredActions.includes(Permissions.Actions.READ)) {
      permissionsToInsert.push({
        memberRoleId: memberRole.id,
        resourceId: projectIssuesResourceId,
        actionId: readActionId,
      });
    }
    if (requiredActions.includes(Permissions.Actions.UPDATE)) {
      permissionsToInsert.push({
        memberRoleId: memberRole.id,
        resourceId: projectIssuesResourceId,
        actionId: updateActionId,
      });
    }
    if (requiredActions.includes(Permissions.Actions.DELETE)) {
      permissionsToInsert.push({
        memberRoleId: memberRole.id,
        resourceId: projectIssuesResourceId,
        actionId: deleteActionId,
      });
    }
  }

  if (permissionsToInsert.length > 0) {
    // Check existing permissions to avoid duplicates
    const existingPerms = await db.query.permissions.findMany({
      where: eq(permissions.resourceId, projectIssuesResourceId),
    });
    const existingPermsSet = new Set(
      existingPerms.map((p) => `${p.memberRoleId}:${p.actionId}`)
    );

    const filteredPermissionsToInsert = permissionsToInsert.filter(
      (p) => !existingPermsSet.has(`${p.memberRoleId}:${p.actionId}`)
    );

    if (filteredPermissionsToInsert.length > 0) {
      await db.insert(permissions).values(filteredPermissionsToInsert);
      console.log(
        `Inserted ${filteredPermissionsToInsert.length} new permissions for ${roleName}`
      );
    } else {
      console.log(`No new permissions needed for ${roleName}`);
    }
  } else {
    console.log(`No permissions defined for ${roleName} on PROJECT_ISSUES`);
  }
}

// Add permissions for each role
await addPermissionsForRole(
  orgAdminRoleId,
  Permissions.Roles.ORGANIZATION_ADMIN
);
await addPermissionsForRole(
  orgManagerRoleId,
  Permissions.Roles.ORGANIZATION_MANAGER
);
await addPermissionsForRole(
  projectManagerRoleId,
  Permissions.Roles.PROJECT_MANAGER
);
await addPermissionsForRole(
  projectMemberRoleId,
  Permissions.Roles.PROJECT_MEMBER
);

console.log("Project issues permissions setup completed successfully");
