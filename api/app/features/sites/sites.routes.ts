import { Router } from "express";
import { siteHandlers as handlers } from "./sites.handlers";
import PermissionsMiddlewares from "../permissions/permissions.middlewares";
import { Permissions } from "../permissions/permissions.types";

export default Router()
  .get("", handlers.list)
  .get(
    "/:id",
    PermissionsMiddlewares.sites(
      Permissions.Resources.ORGANIZATION_SITES,
      Permissions.Actions.READ
    ),
    handlers.get
  )
  .post(
    "",
    PermissionsMiddlewares.sites(
      Permissions.Resources.ORGANIZATION_SITES,
      Permissions.Actions.CREATE
    ),
    handlers.create
  )
  .put(
    "/:id",
    PermissionsMiddlewares.sites(
      Permissions.Resources.ORGANIZATION_SITES,
      Permissions.Actions.UPDATE
    ),
    handlers.update
  )
  .delete(
    "/:id",
    PermissionsMiddlewares.sites(
      Permissions.Resources.ORGANIZATION_SITES,
      Permissions.Actions.DELETE
    ),
    handlers.delete
  )
  // Temporary
  .put(
    "/:id/link-projects",
    PermissionsMiddlewares.sites(
      Permissions.Resources.ORGANIZATION_SITES,
      Permissions.Actions.UPDATE
    ),
    handlers.linkProjects
  );
