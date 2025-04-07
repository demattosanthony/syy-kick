import { Router } from "express";
import { issueHandlers as handlers } from "./issues.handlers";

export default Router({
  mergeParams: true,
})
  // Routes requiring projectId context
  .get(
    "",
    // PermissionsMiddlewares.projects(
    //   Permissions.Resources.PROJECT_ISSUES,
    //   Permissions.Actions.READ
    // ),
    handlers.list
  )
  .post(
    "",
    // PermissionsMiddlewares.projects(
    //   Permissions.Resources.PROJECT_ISSUES,
    //   Permissions.Actions.CREATE
    // ),
    handlers.create
  )

  // Routes operating on a specific issueId
  .get(
    "/:issueNumber",
    // Add permission check for reading a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.READ),
    handlers.get
  )
  .patch(
    // Using PATCH for partial updates is common
    "/:issueNumber",
    // Add permission check for updating a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.UPDATE),
    handlers.update
  )
  .delete(
    "/:issueNumber",
    // Add permission check for deleting a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.DELETE),
    handlers.delete
  );
