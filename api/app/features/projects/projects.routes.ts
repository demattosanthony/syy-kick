import { Router } from "express";
import PermissionsMiddlewares from "../permissions/permissions.middlewares";
import { Permissions } from "../permissions/permissions.types";
import { handlers } from "./projects.handlers";
import { handlers as documentsHandlers } from "./docs/documents.handlers";
import documentsRoutes from "./docs/documents.routes";

export default Router()
  .post(
    "/",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.CREATE
    ),
    handlers.createProject
  )
  .get("/", handlers.listProjects)
  .patch(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.UPDATE
    ),
    handlers.updateProject
  )
  .get(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.READ
    ),
    handlers.getProject
  )
  .delete(
    "/:projectId",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECTS,
      Permissions.Actions.DELETE
    ),
    handlers.deleteProject
  )
  .use("/:projectId/documents", documentsRoutes)
  .get(
    "/:projectId/document",
    PermissionsMiddlewares.projects(
      Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
      Permissions.Actions.READ
    ),
    documentsHandlers.getDocument
  );
