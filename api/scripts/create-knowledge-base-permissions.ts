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

// 1. Insert the new knowledge base resources
console.log("Adding knowledge base resources to the database...");
await db.insert(resources).values([
  {
    name: Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES,
    description: "Knowledge bases within the organization",
  },
  {
    name: Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS,
    description: "Documents within knowledge bases",
  },
]);

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

// 3. Get IDs for the newly added knowledge base resources
const knowledgeBaseResourceId = findIdByName(
  resourcesList,
  Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES
);
const knowledgeBaseDocsResourceId = findIdByName(
  resourcesList,
  Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS
);

if (!knowledgeBaseResourceId || !knowledgeBaseDocsResourceId) {
  console.error("Knowledge base resources not found after insertion");
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
    `Adding permissions for ${roleName} (${memberRolesList.length} members)`
  );

  // Make sure these IDs are all defined before proceeding
  if (
    !knowledgeBaseResourceId ||
    !knowledgeBaseDocsResourceId ||
    !createActionId ||
    !readActionId ||
    !updateActionId ||
    !deleteActionId
  ) {
    console.error("Required resource or action IDs are undefined");
    return;
  }

  for (const memberRole of memberRolesList) {
    const permissionsToAdd = [];
    const roleAccess = Constants.Access[roleName];

    // Add permissions for knowledge bases
    if (
      roleAccess[Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES].includes(
        Permissions.Actions.CREATE
      )
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseResourceId,
        actionId: createActionId,
      });
    }

    if (
      roleAccess[Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES].includes(
        Permissions.Actions.READ
      )
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseResourceId,
        actionId: readActionId,
      });
    }

    if (
      roleAccess[Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES].includes(
        Permissions.Actions.UPDATE
      )
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseResourceId,
        actionId: updateActionId,
      });
    }

    if (
      roleAccess[Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES].includes(
        Permissions.Actions.DELETE
      )
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseResourceId,
        actionId: deleteActionId,
      });
    }

    // Add permissions for knowledge base docs
    if (
      roleAccess[
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS
      ].includes(Permissions.Actions.CREATE)
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseDocsResourceId,
        actionId: createActionId,
      });
    }

    if (
      roleAccess[
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS
      ].includes(Permissions.Actions.READ)
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseDocsResourceId,
        actionId: readActionId,
      });
    }

    if (
      roleAccess[
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS
      ].includes(Permissions.Actions.UPDATE)
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseDocsResourceId,
        actionId: updateActionId,
      });
    }

    if (
      roleAccess[
        Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_DOCS
      ].includes(Permissions.Actions.DELETE)
    ) {
      permissionsToAdd.push({
        memberRoleId: memberRole.id,
        resourceId: knowledgeBaseDocsResourceId,
        actionId: deleteActionId,
      });
    }

    if (permissionsToAdd.length > 0) {
      await db.insert(permissions).values(permissionsToAdd);
    }
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

console.log("Knowledge base permissions created successfully");
