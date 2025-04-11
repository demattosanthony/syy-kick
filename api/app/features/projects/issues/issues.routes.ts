import { Router } from "express";
import { issueHandlers as handlers } from "./issues.handlers";
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";
import { Permissions } from "../../permissions/permissions.types";

export default Router({
  mergeParams: true,
})
  .get(
    "",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.READ
    ),
    handlers.list
  )
  .post(
    "",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.CREATE
    ),
    handlers.create
  )

  .get(
    "/:issueNumber",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.READ
    ),
    handlers.get
  )
  .patch(
    "/:issueNumber",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.UPDATE
    ),
    handlers.update
  )
  .delete(
    "/:issueNumber",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.DELETE
    ),
    handlers.delete
  )

  // --- Comment Routes (nested under issues) ---
  .post(
    "/:issueNumber/comments",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.CREATE
    ),
    handlers.createComment
  )
  .patch(
    "/:issueNumber/comments/:commentId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.UPDATE
    ),
    handlers.updateComment
  )
  .delete(
    "/:issueNumber/comments/:commentId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.PROJECT_ISSUES,
      Permissions.Actions.DELETE
    ),
    handlers.deleteComment
  );
