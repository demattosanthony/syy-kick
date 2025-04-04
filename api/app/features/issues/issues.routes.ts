import { Router } from "express";
import { issueHandlers as handlers } from "./issues.handlers";
import PermissionsMiddlewares from "../permissions/permissions.middlewares";
import { Permissions } from "../permissions/permissions.types"; // Assuming types are in this structure

export default Router()
  // Routes requiring projectId context
  .get(
    "/projects/:projectId/issues",
    // PermissionsMiddlewares.projects(
    //   Permissions.Resources.PROJECT_ISSUES,
    //   Permissions.Actions.READ
    // ),
    handlers.list
  )
  .post(
    "/projects/:projectId/issues",
    // PermissionsMiddlewares.projects(
    //   Permissions.Resources.PROJECT_ISSUES,
    //   Permissions.Actions.CREATE
    // ),
    handlers.create
  )

  // Routes operating on a specific issueId
  .get(
    "/projects/:projectId/issues/:issueNumber",
    // Add permission check for reading a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.READ),
    handlers.get
  )
  .patch(
    // Using PATCH for partial updates is common
    "/projects/:projectId/issues/:issueId",
    // Add permission check for updating a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.UPDATE),
    handlers.update
  )
  .delete(
    "/projects/:projectId/issues/:issueId",
    // Add permission check for deleting a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.DELETE),
    handlers.delete
  );
