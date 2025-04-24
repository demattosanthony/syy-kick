/** Express */
import { Router } from "express";

/** Middlewares */
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";

/** Types */
import { Permissions } from "../../permissions/permissions.types";

/** Handlers */
import { handlers } from "./access-logs.handlers";

export default Router({ mergeParams: true })
    .get(
        "",
        PermissionsMiddlewares.knowledgeBases(
            Permissions.Resources.ORGANIZATION_KNOWLEDGE_BASES_ACCESS_LOGS,
            Permissions.Actions.READ
        ),
        handlers.list
    )