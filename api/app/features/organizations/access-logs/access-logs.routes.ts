/** Express */
import { Router } from "express";

/** Handlers */
import { handlers } from "./access-logs.handlers";

/** Types */
import { Permissions } from "../../permissions/permissions.types";

/** Middlewares */
import PermissionsMiddlewares from "../../permissions/permissions.middlewares";

export default Router({ mergeParams: true })
    .get(
        "",
        PermissionsMiddlewares.organizations(
            Permissions.Resources.ORGANIZATION_ACCESS_LOGS,
            Permissions.Actions.READ
        ),
        handlers.getAccessLogs
    );