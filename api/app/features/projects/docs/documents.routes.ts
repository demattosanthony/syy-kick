import { Router } from "express";
import { handlers } from "./documents.handlers";
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";
import { Permissions } from "../../permissions/permissions.types";

export default Router()
    .get("",
        PermissionsMiddlewares.projects(
            Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
            Permissions.Actions.READ
        ),
        handlers.getDocuments
    )
    .post("",
        PermissionsMiddlewares.projects(
            Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
            Permissions.Actions.CREATE
        ),
        handlers.documentsUpload
    )
    .delete("",
        PermissionsMiddlewares.projects(
            Permissions.Resources.ORGANIZATION_PROJECT_DOCS,
            Permissions.Actions.DELETE
        ),
        handlers.deleteContents
    );