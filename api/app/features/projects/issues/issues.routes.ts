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
  )

  // --- Comment Routes (nested under issues) ---
  .post(
    "/:issueNumber/comments",
    // Add permission check for creating comments on a specific issue
    // Example: PermissionsMiddlewares.issue(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.CREATE), // Or a specific COMMENT permission
    handlers.createComment
  )
  .patch(
    "/:issueNumber/comments/:commentId", // Route specific to a comment ID
    // Add permission check for updating a specific comment
    // Example: PermissionsMiddlewares.comment(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.UPDATE),
    handlers.updateComment
  )
  .delete(
    "/:issueNumber/comments/:commentId", // Route specific to a comment ID
    // Add permission check for deleting a specific comment
    // Example: PermissionsMiddlewares.comment(Permissions.Resources.PROJECT_ISSUES, Permissions.Actions.DELETE),
    handlers.deleteComment
  );
