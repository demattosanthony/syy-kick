import { Router } from "express";
import { issueHandlers as handlers } from "./issues.handlers";
import PermissionsMiddlewares from "../permissions/permissions.middlewares";
import { Permissions } from "../permissions/permissions.types"; // Assuming types are in this structure

export default Router()
  // Routes requiring projectId context
  .get(
    "/projects/:projectId/issues",
    // Add permission check for listing issues within a project if needed
    // Example: PermissionsMiddlewares.project(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.LIST),
    handlers.list
  )
  .post(
    "/projects/:projectId/issues",
    // Add permission check for creating issues within a project
    // Example: PermissionsMiddlewares.project(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.CREATE),
    handlers.create
  )

  // Routes operating on a specific issueId
  .get(
    "/issues/:issueId",
    // Add permission check for reading a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.READ),
    handlers.get
  )
  .patch(
    // Using PATCH for partial updates is common
    "/issues/:issueId",
    // Add permission check for updating a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.UPDATE),
    handlers.update
  )
  .delete(
    "/issues/:issueId",
    // Add permission check for deleting a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.DELETE),
    handlers.delete
  );
